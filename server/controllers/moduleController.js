const User = require('../models/User');
const Report = require('../models/Report');
const Interview = require('../models/Interview');
const Debate = require('../models/Debate');
const Presentation = require('../models/Presentation');
const Email = require('../models/Email');
const Achievement = require('../models/Achievement');
const GrowthAnalytics = require('../models/GrowthAnalytics');
const CommunicationScores = require('../models/CommunicationScores');
const geminiService = require('../utils/geminiService');

// Helper to award XP and update User level/skills
const awardXP = async (userId, xpReward, newSkills = {}) => {
  const user = await User.findById(userId);
  if (!user) return null;

  user.experiencePoints += xpReward;
  
  // Level up logic: level * 100 is required to level up
  let xpNeeded = user.level * 100;
  while (user.experiencePoints >= xpNeeded) {
    user.experiencePoints -= xpNeeded;
    user.level += 1;
    xpNeeded = user.level * 100;
  }

  // Update skills with moving average
  if (Object.keys(newSkills).length > 0) {
    Object.keys(newSkills).forEach(skillKey => {
      if (user.skills[skillKey] !== undefined) {
        user.skills[skillKey] = Math.round((user.skills[skillKey] * 0.7) + (newSkills[skillKey] * 0.3));
      }
    });
  }

  user.lastPracticeDate = new Date();
  
  // Update placement readiness/career score based on average skills
  const skillValues = Object.values(user.skills);
  const avgSkill = skillValues.reduce((sum, val) => sum + val, 0) / skillValues.length;
  user.careerScore = Math.round(avgSkill);

  // Generate dynamic DNA profile after 3 completed reports
  const reportCount = await Report.countDocuments({ userId });
  if (reportCount >= 2) {
    if (avgSkill > 85) {
      user.communicationDNA.archetype = "Master Orator";
      user.communicationDNA.description = "You speak with extreme confidence, precision, and clarity. Your arguments are logically sound and persuasive.";
      user.communicationDNA.strengths = ["Vocal Clarity", "Logical Structure", "Persuasiveness"];
      user.communicationDNA.weaknesses = ["Over-analytical framing"];
    } else if (avgSkill > 75) {
      user.communicationDNA.archetype = "Charismatic Diplomat";
      user.communicationDNA.description = "You focus on balance and collaboration. You excel at group discussion structures and active listening.";
      user.communicationDNA.strengths = ["Active Listening", "Collaboration", "Pacing"];
      user.communicationDNA.weaknesses = ["Assertive counter-rebuttals"];
    } else {
      user.communicationDNA.archetype = "Emerging Leader";
      user.communicationDNA.description = "You demonstrate high enthusiasm and clarity, but require practice to refine transitions and reduce filler words.";
      user.communicationDNA.strengths = ["Enthusiasm", "Grammar"],
      user.communicationDNA.weaknesses = ["Filler Word Usage", "Pacing under pressure"];
    }
  }

  await user.save();
  return user;
};

// Helper to check and unlock achievements
const checkAchievements = async (userId, moduleType, score) => {
  const achievements = [];
  const existing = await Achievement.find({ userId });
  const hasBadge = (badgeId) => existing.some(e => e.badgeId === badgeId);

  // 1. First Practice Badge
  if (!hasBadge('first_step')) {
    const badge = await Achievement.create({
      userId,
      badgeId: 'first_step',
      title: 'First Step taken',
      description: 'Completed your first communication analysis.',
      icon: 'zap'
    });
    achievements.push(badge);
  }

  // 2. High Score Badges based on modules
  if (score >= 80) {
    if (moduleType === 'analyzer' && !hasBadge('confidence_champion')) {
      const badge = await Achievement.create({
        userId,
        badgeId: 'confidence_champion',
        title: 'Confidence Champion',
        description: 'Scored 80+ in Speech Communication Analysis.',
        icon: 'heart'
      });
      achievements.push(badge);
    }
    if (moduleType === 'debate' && !hasBadge('debate_master')) {
      const badge = await Achievement.create({
        userId,
        badgeId: 'debate_master',
        title: 'Debate Master',
        description: 'Scored 80+ in the AI Debate Arena.',
        icon: 'sword'
      });
      achievements.push(badge);
    }
    if (moduleType === 'public-speaking' && !hasBadge('public_speaking_pro')) {
      const badge = await Achievement.create({
        userId,
        badgeId: 'public_speaking_pro',
        title: 'Public Speaking Pro',
        description: 'Scored 80+ in the Public Speaking Trainer.',
        icon: 'mic'
      });
      achievements.push(badge);
    }
    if (moduleType === 'interview' && !hasBadge('interview_ace')) {
      const badge = await Achievement.create({
        userId,
        badgeId: 'interview_ace',
        title: 'Interview Ace',
        description: 'Scored 80+ in Mock Interview Readiness.',
        icon: 'briefcase'
      });
      achievements.push(badge);
    }
  }

  return achievements;
};

// @desc    Analyze speech transcript (Module 1)
// @route   POST /api/modules/analyze
// @access  Private
exports.analyzeSpeech = async (req, res) => {
  const { transcript } = req.body;
  if (!transcript) {
    return res.status(400).json({ message: "Transcript text is required." });
  }

  try {
    const analysis = await geminiService.analyzeSpeech(transcript);
    
    // Save report
    const report = await Report.create({
      userId: req.user._id,
      moduleType: 'analyzer',
      title: 'Speech Analysis Report',
      overallScore: analysis.overallScore,
      metrics: analysis.metrics,
      feedback: analysis.feedback,
      suggestions: analysis.suggestions,
      transcript: transcript
    });

    // Update user growth metrics
    await CommunicationScores.create({
      userId: req.user._id,
      overall: analysis.overallScore,
      confidence: analysis.metrics.confidence,
      fluency: analysis.metrics.fluency,
      grammar: analysis.metrics.grammar,
      vocabulary: analysis.metrics.vocabulary
    });

    const updatedUser = await awardXP(req.user._id, 50, {
      confidence: analysis.metrics.confidence,
      fluency: analysis.metrics.fluency,
      speakingSpeed: analysis.metrics.speakingSpeed,
      fillerWords: analysis.metrics.fillerWords,
      grammar: analysis.metrics.grammar,
      pronunciation: analysis.metrics.pronunciation,
      vocabulary: analysis.metrics.vocabulary,
      tone: analysis.metrics.tone,
      clarity: analysis.metrics.clarity
    });

    const newBadges = await checkAchievements(req.user._id, 'analyzer', analysis.overallScore);

    res.status(200).json({ report, user: updatedUser, newBadges });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    GD Trainer conversation reply (Module 2)
// @route   POST /api/modules/gd/reply
// @access  Private
exports.gdReply = async (req, res) => {
  const { topic, messages, speechMetrics } = req.body; // messages contains array of {sender, content}
  if (!topic || !messages) {
    return res.status(400).json({ message: "Topic and message history are required." });
  }

  try {
    const reply = await geminiService.generateGDResponse(topic, messages, speechMetrics);

    // If final, save GD session as a report
    let report = null;
    let updatedUser = null;
    let newBadges = [];
    
    if (reply.analysis) {
      report = await Report.create({
        userId: req.user._id,
        moduleType: 'gd',
        title: `Group Discussion: ${topic}`,
        overallScore: reply.analysis.overallScore,
        metrics: {
          collaboration: reply.analysis.collabScore,
          argumentQuality: reply.analysis.argumentQuality,
          leadership: reply.analysis.leadershipScore,
          participation: reply.analysis.participationPercent,
          speechMetrics: reply.analysis.speechMetrics || {
            speakingPaceWPM: speechMetrics?.avgWpm || 140,
            paceStatus: 'Optimal Cadence (130-165 WPM)',
            fillerWordsCount: speechMetrics?.totalFillers || 0,
            fillerWordsList: speechMetrics?.fillerList || ["None detected"],
            fluencyScore: 88,
            vocalConfidence: 86,
            clarity: 88
          }
        },
        feedback: reply.analysis.feedback,
        suggestions: reply.analysis.suggestions,
        transcript: messages.map(m => `${m.sender}: ${m.content}`).join('\n')
      });

      const speechData = reply.analysis.speechMetrics || {};
      updatedUser = await awardXP(req.user._id, 100, {
        clarity: speechData.clarity || reply.analysis.argumentQuality || 85,
        confidence: speechData.vocalConfidence || reply.analysis.leadershipScore || 85,
        fluency: speechData.fluencyScore || 85,
        speakingSpeed: speechData.speakingPaceWPM ? Math.min(100, Math.round(speechData.speakingPaceWPM / 2)) : 70,
        fillerWords: speechData.fillerWordsCount || 0
      });

      newBadges = await checkAchievements(req.user._id, 'gd', reply.analysis.overallScore);
    }

    res.status(200).json({ reply, report, user: updatedUser, newBadges });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Public speaking evaluator (Module 3)
// @route   POST /api/modules/public-speaking
// @access  Private
exports.evaluatePublicSpeaking = async (req, res) => {
  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ message: "Speech script is required." });
  }

  try {
    const analysis = await geminiService.analyzePublicSpeaking(text);

    const report = await Report.create({
      userId: req.user._id,
      moduleType: 'public-speaking',
      title: 'Public Speaking Roadmap Report',
      overallScore: analysis.overallScore,
      metrics: analysis.metrics,
      feedback: `Strengths: ${analysis.strengths.join(', ')}\nWeaknesses: ${analysis.weaknesses.join(', ')}`,
      suggestions: analysis.improvementRoadmap.map(r => `${r.phase}: ${r.goal}`),
      transcript: text
    });

    const updatedUser = await awardXP(req.user._id, 80, {
      confidence: analysis.metrics.confidence,
      clarity: analysis.metrics.clarity
    });

    const newBadges = await checkAchievements(req.user._id, 'public-speaking', analysis.overallScore);

    res.status(200).json({ report, analysis, user: updatedUser, newBadges });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Presentation evaluator (Module 4)
// @route   POST /api/modules/presentation
// @access  Private
exports.evaluatePresentation = async (req, res) => {
  const { title, slideCount, rawText, spokenTranscript } = req.body;
  if (!title) {
    return res.status(400).json({ message: "Presentation title is required." });
  }

  try {
    const analysis = await geminiService.evaluatePresentation(
      title, 
      slideCount || 1, 
      rawText || "", 
      spokenTranscript || ""
    );

    const presDoc = await Presentation.create({
      userId: req.user._id,
      title,
      slideCount: slideCount || 1,
      scores: analysis.scores,
      speakerNotes: analysis.speakerNotes,
      presentationScript: analysis.presentationScript,
      expectedQuestions: analysis.expectedQuestions,
      suggestions: analysis.suggestions
    });

    const report = await Report.create({
      userId: req.user._id,
      moduleType: 'presentation',
      title: `Presentation Review: ${title}`,
      overallScore: analysis.overallScore,
      metrics: analysis.scores,
      feedback: `Overall Score: ${analysis.overallScore}%. Clarity: ${analysis.scores.speechClarity || 85}%.`,
      suggestions: analysis.suggestions,
      transcript: spokenTranscript || `Slides Analyzed: ${slideCount}`
    });

    const updatedUser = await awardXP(req.user._id, 85, {
      clarity: analysis.scores.effectiveness || 80,
      vocabulary: analysis.scores.professionalism || 80,
      confidence: analysis.scores.speechClarity || 85
    });

    const newBadges = await checkAchievements(req.user._id, 'presentation', analysis.overallScore);

    res.status(200).json({ 
      presentation: {
        ...analysis,
        _id: presDoc._id,
        title: presDoc.title
      }, 
      report, 
      user: updatedUser,
      newBadges
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Email Assistant conversion (Module 5)
// @route   POST /api/modules/email
// @access  Private
exports.assistEmail = async (req, res) => {
  const { originalContent, fromTone, toTone } = req.body;
  if (!originalContent) {
    return res.status(400).json({ message: "Original email content is required." });
  }

  try {
    const conversion = await geminiService.assistEmail(originalContent, fromTone || 'Casual', toTone || 'Professional');

    const emailDoc = await Email.create({
      userId: req.user._id,
      originalContent,
      convertedContent: conversion.convertedContent,
      fromTone,
      toTone,
      grammarErrors: conversion.grammarErrors,
      suggestions: conversion.suggestions
    });

    const updatedUser = await awardXP(req.user._id, 30, {
      grammar: conversion.grammarErrors.length === 0 ? 95 : Math.max(50, 90 - conversion.grammarErrors.length * 8)
    });

    res.status(200).json({ email: emailDoc, user: updatedUser });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get Mock Interview questions (Module 6)
// @route   POST /api/modules/interview/questions
// @access  Private
exports.getInterviewQuestions = async (req, res) => {
  const { jobTitle } = req.body;
  if (!jobTitle) {
    return res.status(400).json({ message: "Job title is required." });
  }

  try {
    const questions = await geminiService.generateInterviewQuestions(jobTitle);
    res.status(200).json({ questions });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Evaluate Mock Interview answers (Module 6)
// @route   POST /api/modules/interview/submit
// @access  Private
exports.submitInterview = async (req, res) => {
  const { jobTitle, questions, answers } = req.body;
  if (!jobTitle || !questions || !answers) {
    return res.status(400).json({ message: "Job title, questions, and answers are required." });
  }

  try {
    const evaluation = await geminiService.evaluateInterview(jobTitle, questions, answers);

    const interviewDoc = await Interview.create({
      userId: req.user._id,
      jobTitle,
      questions,
      answers,
      scores: evaluation.scores,
      feedback: evaluation.feedback,
      readinessScore: evaluation.readinessScore
    });

    const report = await Report.create({
      userId: req.user._id,
      moduleType: 'interview',
      title: `Interview Readiness: ${jobTitle}`,
      overallScore: evaluation.overallScore,
      metrics: evaluation.scores,
      feedback: evaluation.feedback,
      suggestions: evaluation.suggestions,
      transcript: questions.map((q, idx) => `Q: ${q}\nA: ${answers[idx]}`).join('\n\n')
    });

    const updatedUser = await awardXP(req.user._id, 150, {
      confidence: evaluation.scores.confidence,
      vocabulary: evaluation.scores.vocabulary,
      tone: evaluation.scores.professionalism
    });

    const newBadges = await checkAchievements(req.user._id, 'interview', evaluation.overallScore);

    res.status(200).json({ interview: interviewDoc, report, user: updatedUser, newBadges });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Debate round submission (Module 7)
// @route   POST /api/modules/debate/reply
// @access  Private
exports.debateReply = async (req, res) => {
  const { topic, history } = req.body;
  if (!topic || !history) {
    return res.status(400).json({ message: "Topic and history are required." });
  }

  try {
    const reply = await geminiService.debateRound(topic, history);

    let report = null;
    let updatedUser = null;
    let newBadges = [];

    if (reply.analysis) {
      // Create Debate log
      await Debate.create({
        userId: req.user._id,
        topic,
        transcript: history,
        score: reply.analysis.overallScore,
        metrics: reply.analysis.metrics,
        feedback: reply.analysis.feedback
      });

      report = await Report.create({
        userId: req.user._id,
        moduleType: 'debate',
        title: `Debate Arena: ${topic}`,
        overallScore: reply.analysis.overallScore,
        metrics: reply.analysis.metrics,
        feedback: reply.analysis.feedback,
        suggestions: ["Structure argument maps visually.", "Engage rebuttals with targeted questions."],
        transcript: history.map(h => `${h.sender.toUpperCase()}: ${h.content}`).join('\n')
      });

      updatedUser = await awardXP(req.user._id, 120, {
        clarity: reply.analysis.metrics.logicScore,
        confidence: reply.analysis.metrics.persuasion
      });

      newBadges = await checkAchievements(req.user._id, 'debate', reply.analysis.overallScore);
    }

    res.status(200).json({ reply, report, user: updatedUser, newBadges });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Growth dashboard historical analysis (Module 8)
// @route   GET /api/modules/growth
// @access  Private
exports.getGrowthStats = async (req, res) => {
  try {
    const reports = await Report.find({ userId: req.user._id }).sort({ createdAt: 1 });
    const scoreHistory = await CommunicationScores.find({ userId: req.user._id }).sort({ date: 1 });
    const achievements = await Achievement.find({ userId: req.user._id });

    // Map stats
    const progressHistory = scoreHistory.map(s => ({
      date: s.date.toLocaleDateString(),
      overall: s.overall,
      confidence: s.confidence,
      vocabulary: s.vocabulary
    }));

    res.status(200).json({
      reportsCount: reports.length,
      achievementsCount: achievements.length,
      progressHistory,
      recentReports: reports.slice(-5).reverse(),
      achievements
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Anonymous leaderboard (Module 8)
// @route   GET /api/modules/community
// @access  Private
exports.getLeaderboard = async (req, res) => {
  try {
    const users = await User.find({})
      .select('username level careerScore avatar')
      .sort({ careerScore: -1 })
      .limit(10);
    
    // Anonymize user names except the current user's
    const leaderboard = users.map((u, index) => ({
      rank: index + 1,
      isCurrentUser: u._id.equals(req.user._id),
      username: u._id.equals(req.user._id) ? u.username : `Speaker #${1024 + index}`,
      level: u.level,
      score: u.careerScore,
      avatar: u.avatar
    }));

    res.status(200).json({ leaderboard });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
