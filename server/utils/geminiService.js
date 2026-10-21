const { GoogleGenerativeAI } = require("@google/generative-ai");

// Helper to safely parse JSON from Gemini response
function safeParseJSON(text) {
  try {
    // Strip markdown code block if present
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (err) {
    console.error("JSON parsing error on response text:", text, err);
    throw new Error("Invalid JSON format returned from AI model");
  }
}

// Check if Gemini API is available
const apiKey = process.env.GEMINI_API_KEY;
let genAI = null;
if (apiKey) {
  try {
    genAI = new GoogleGenerativeAI(apiKey);
    console.log("Gemini AI Client initialized successfully.");
  } catch (error) {
    console.error("Error initializing Gemini client:", error);
  }
} else {
  console.log("No GEMINI_API_KEY found. Running in high-fidelity Mock fallback mode.");
}

// ----------------------------------------------------
// Mock fallbacks for context-aware, rich simulations
// ----------------------------------------------------
const mockSpeechAnalysis = (transcript) => {
  const words = transcript.split(/\s+/).filter(Boolean).length;
  const confidence = Math.min(95, Math.max(65, 75 + Math.floor(Math.random() * 20) - (words < 10 ? 15 : 0)));
  const fillerCount = (transcript.match(/\b(um|uh|like|you know|so|basically)\b/gi) || []).length;
  
  return {
    overallScore: Math.round((confidence + 80 + 78 + 85) / 4),
    metrics: {
      confidence,
      fluency: Math.min(98, Math.max(60, 80 - fillerCount * 4)),
      speakingSpeed: words > 0 ? Math.round((words / 0.5)) : 0, // Mock speaking speed words per min
      fillerWords: fillerCount,
      grammar: 85,
      pronunciation: 82,
      vocabulary: Math.min(95, 70 + Math.floor(words / 15)),
      tone: 80,
      clarity: 84,
      eyeContact: 88,
      facialEngagement: 85
    },
    feedback: "Your speech shows a strong core message. You kept a good pace, but focus on reducing transitional filler words like 'basically' or 'like' to sound more authoritative.",
    suggestions: [
      "Pause for 1 second instead of using 'um' or 'like'.",
      "Vary your pitch at the end of key sentences to emphasize points.",
      "Work on speaking speed consistency."
    ],
    transcript
  };
};

const mockGDParticipants = (topic) => {
  return [
    { name: "Siddharth (Visionary)", avatar: "avatar2", personality: "Creative, looking at the big picture, supportive.", opinion: "I think this topic offers massive potential for disruptive innovation, especially if we consider long-term global scaling." },
    { name: "Ananya (Data Critic)", avatar: "avatar3", personality: "Analytical, details-oriented, skeptical of vague claims.", opinion: "We must analyze current statistical trends. The financial viability of this topic is questionable without structural backing." },
    { name: "Rohan (Mediator)", avatar: "avatar4", personality: "Calm, diplomatic, reconciles different opinions.", opinion: "Both Siddharth and Ananya make great points. Let's find a middle ground that balances risk and long-term vision." },
    { name: "Elena (Challenger)", avatar: "avatar5", personality: "Assertive, debates hard, points out loopholes.", opinion: "We are ignoring the key ethical implications. We need to address regulation before discussing profits." }
  ];
};

const mockGDDiscussion = (topic, messages, speechMetrics = null) => {
  const participants = mockGDParticipants(topic);
  const userMessagesCount = messages.filter(m => m.sender === 'user').length;
  
  // Pick a random participant that hasn't spoken in the last turn
  const lastSender = messages.length > 0 ? messages[messages.length - 1].sender : null;
  const candidates = participants.filter(p => p.name !== lastSender);
  const speaker = candidates[Math.floor(Math.random() * candidates.length)];
  
  let aiResponse = "";
  if (userMessagesCount === 0) {
    aiResponse = `Welcome everyone to our executive group discussion on: "${topic}". Let's kick off. Siddharth, what are your initial strategic thoughts?`;
  } else {
    const lastUserMsg = [...messages].reverse().find(m => m.sender === 'user')?.content || "";
    aiResponse = `Reflecting on the user's point about "${lastUserMsg.substring(0, 30)}...", I agree with Rohan's balancing approach, but we must also address Ananya's data concerns. What do you all think?`;
  }

  // Calculate scores (if ending)
  const isFinal = messages.length >= 6;
  let analysis = null;

  if (isFinal) {
    const userText = messages.filter(m => m.sender === 'user').map(m => m.content).join(' ');
    const words = userText.split(/\s+/).filter(Boolean).length;
    const detectedFillers = (userText.match(/\b(um|uh|like|basically|you know|so|actually)\b/gi) || []);
    const fillerCount = speechMetrics?.totalFillers !== undefined ? speechMetrics.totalFillers : detectedFillers.length;
    const wpm = speechMetrics?.avgWpm ? Math.round(speechMetrics.avgWpm) : (words > 0 ? Math.round(words * 1.3) : 142);
    const fillerList = speechMetrics?.fillerList && speechMetrics.fillerList.length > 0 
      ? speechMetrics.fillerList 
      : Array.from(new Set(detectedFillers.map(f => f.toLowerCase())));

    analysis = {
      overallScore: Math.min(98, Math.max(65, Math.round((84 + Math.max(60, 95 - fillerCount * 3)) / 2))),
      collabScore: 88,
      argumentQuality: 82,
      leadershipScore: 85,
      participationPercent: Math.round((userMessagesCount / (messages.length + 1)) * 100),
      speechMetrics: {
        speakingPaceWPM: wpm,
        paceStatus: wpm >= 130 && wpm <= 165 ? "Optimal Cadence (130-165 WPM)" : (wpm > 165 ? "Fast / Slightly Rushed" : "Deliberate / Hesitant"),
        fillerWordsCount: fillerCount,
        fillerWordsList: fillerList.length > 0 ? fillerList : ["None detected"],
        fluencyScore: Math.min(98, Math.max(65, 92 - fillerCount * 3)),
        vocalConfidence: Math.min(96, Math.max(70, 89 - fillerCount * 2)),
        clarity: 88
      },
      feedback: "Exceptional boardroom leadership and articulate vocal delivery. You synthesized arguments effectively from multiple stakeholders while maintaining a persuasive, executive cadence.",
      suggestions: [
        "Replace filler phrases with silent 1-second pauses when formulating rebuttals.",
        "Acknowledge Ananya's statistical points directly before advancing your next proposal.",
        "Maintain your steady pacing when counter-arguing assertive participants like Elena."
      ]
    };
  }

  return {
    sender: speaker.name,
    avatar: speaker.avatar,
    content: aiResponse,
    analysis
  };
};

const mockPublicSpeaking = (text) => {
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
  const fillerCount = (text.match(/\b(um|uh|like|basically|you know|so|actually)\b/gi) || []).length;

  return {
    overallScore: Math.min(96, Math.max(65, 85 - fillerCount * 3)),
    metrics: {
      voiceModulation: 82,
      confidence: Math.min(95, Math.max(60, 88 - fillerCount * 4)),
      clarity: 88,
      structure: 84,
      audienceEngagement: 85,
      speakingPace: words > 0 ? Math.round(words * 1.4) : 135,
      persuasiveness: 83
    },
    mistakesAndCorrections: [
      {
        type: "Filler Word & Hesitation",
        spoken: text ? text.substring(0, 60) + "..." : "Um, basically, I want to talk about how like innovation is key...",
        correction: "Today, I will demonstrate why continuous innovation is our primary competitive advantage.",
        reason: "Filler words ('um', 'basically', 'like') reduce rhetorical authority and audience engagement."
      },
      {
        type: "Weak Passive Phrasing",
        spoken: "I think maybe we should try to consider changing our approach.",
        correction: "We must decisively transform our strategic methodology.",
        reason: "Replace weak qualifiers ('I think maybe', 'try to consider') with strong, assertive action verbs."
      },
      {
        type: "Rushed Cadence & Run-on",
        spoken: "And so we did that and then everyone was happy and things got better fast.",
        correction: "Upon executing this initiative, team productivity soared and client satisfaction reached an all-time high.",
        reason: "Break run-on sentences with deliberate pauses to give key outcomes weight."
      }
    ],
    strengths: [
      "Dynamic opening hook that engages the audience immediately.",
      "Strong vocal resonance and clear articulation.",
      "Well-defined logical progression of core arguments."
    ],
    weaknesses: [
      "Slight reliance on filler transitions between major points.",
      "Cadence accelerated during concluding remarks."
    ],
    improvementRoadmap: [
      { phase: "Week 1", goal: "Practice 2-second deliberate pauses at key rhetorical transitions." },
      { phase: "Week 2", goal: "Eliminate filler words ('um', 'like', 'so') using camera gaze recording." },
      { phase: "Week 3", goal: "Master vocal pitch modulation and powerful closing statements." }
    ]
  };
};

const mockPresentationEvaluation = (title, slideCount, rawTextContent = "", spokenTranscript = "") => {
  const words = spokenTranscript ? spokenTranscript.split(/\s+/).filter(Boolean).length : 0;
  const fillerCount = (spokenTranscript.match(/\b(um|uh|like|basically|you know|so|actually)\b/gi) || []).length;

  return {
    overallScore: spokenTranscript ? Math.min(95, Math.max(65, 84 - fillerCount * 3)) : 81,
    scores: {
      design: 82,
      readability: 85,
      structure: 84,
      professionalism: Math.min(98, Math.max(60, 88 - fillerCount * 4)),
      hierarchy: 80,
      effectiveness: 83,
      speechClarity: spokenTranscript ? Math.min(95, Math.max(60, 86 - fillerCount * 3)) : 85,
      slideAlignment: 88
    },
    speakerNotes: Array.from({ length: Math.min(5, Math.max(1, slideCount)) }, (_, i) => ({
      slideNumber: i + 1,
      notes: `Slide ${i + 1} Delivery Note: Maintain steady eye contact with the audience/camera. Keep vocal transitions clear.`
    })),
    presentationScript: `Presentation Overview: "${title}". Key slide points covered with live vocal delivery analysis.`,
    mistakesAndCorrections: [
      {
        type: "Filler Word",
        spoken: spokenTranscript ? spokenTranscript.substring(0, 60) + "..." : "Um, basically, our main goal here like is to grow revenues...",
        correction: "Our primary objective is to drive revenue growth and expand market reach.",
        reason: "Excessive filler words ('um', 'basically', 'like') diminish executive authority and speech impact."
      },
      {
        type: "Pacing & Hesitation",
        spoken: "So yeah... we have three or four main points to talk about...",
        correction: "We have structured our strategic plan into three key pillars.",
        reason: "Hesitancies make the presenter sound uncertain about the presented material."
      },
      {
        type: "Informal Phrasing",
        spoken: "This thing is gonna be super awesome for our team.",
        correction: "This initiative represents a pivotal strategic advantage for our organization.",
        reason: "Replacing casual phrasing ('gonna', 'super awesome') elevates professional tone."
      }
    ],
    expectedQuestions: [
      { question: "How does this scale in the next 12 months?", suggestedAnswer: "State that our infrastructure scales linearly, supported by projected budget reserves." },
      { question: "What is the primary risk factor?", suggestedAnswer: "Highlight user adoption rates, which we mitigate with our direct marketing framework." }
    ],
    suggestions: [
      "Pause deliberately for 1-2 seconds between slides instead of using filler words.",
      "Maintain active gaze toward the camera lens to build audience connection.",
      "Highlight key slide metrics with strong, decisive vocal emphasis."
    ]
  };
};

const mockEmailConversion = (originalContent, fromTone, toTone) => {
  const converted = `Subject: Refined Professional Correspondence\n\nDear Team,\n\nI am writing to share updates regarding our project timeline. ${originalContent} We look forward to your feedback.\n\nBest regards,\nProfessional Assistant`;
  return {
    convertedContent: converted,
    grammarErrors: [
      { error: "i want to tell", correction: "I am writing to inform", explanation: "More formal and professional tone." }
    ],
    suggestions: [
      "Use bullet points for lists to improve scanning readability.",
      "Keep signature blocks professional."
    ]
  };
};

const mockInterviewQuestions = (jobTitle) => {
  return [
    `Tell me about yourself and your background relative to the ${jobTitle} role.`,
    `Describe a time you faced a difficult technical challenge. How did you resolve it?`,
    `Why do you want to join our organization as a ${jobTitle}?`,
    `How do you handle working under tight deadlines with team conflict?`
  ];
};

const mockInterviewEvaluation = (jobTitle, questions, answers) => {
  return {
    overallScore: 83,
    scores: {
      confidence: 85,
      professionalism: 88,
      clarity: 80,
      vocabulary: 82,
      bodyLanguage: 84
    },
    feedback: `Strong performance for a ${jobTitle} role. You structured answers using the STAR method (Situation, Task, Action, Result) in Question 2.`,
    readinessScore: 85,
    suggestions: [
      "Keep answers slightly more concise (under 2 minutes).",
      "Incorporate more domain-specific vocabulary to demonstrate expertise."
    ]
  };
};

const mockDebateResponse = (topic, history) => {
  const round = history.length;
  const userArguments = history.filter(h => h.sender === 'user');
  const lastUserArg = userArguments[userArguments.length - 1]?.content || "";

  let aiResponse = `While you argue that "${lastUserArg.substring(0, 30)}...", this perspective overlooks the systemic operational bottlenecks. If we prioritize that, we risk neglecting resource allocation efficiency. What is your response to that challenge?`;
  
  const isFinal = round >= 5;
  const analysis = isFinal ? {
    overallScore: 80,
    metrics: {
      criticalThinking: 82,
      persuasion: 78,
      logicScore: 84,
      counterStrength: 76
    },
    feedback: "Excellent critical thinking. You avoided common fallacies and structured logical rebuttals, though your arguments could use more quantitative evidence.",
    leaderboardPoints: 120
  } : null;

  return {
    content: aiResponse,
    analysis
  };
};

// ----------------------------------------------------
// Core API calls connecting to Gemini
// ----------------------------------------------------

exports.analyzeSpeech = async (transcript) => {
  if (!genAI) return mockSpeechAnalysis(transcript);

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `Analyze this speech transcript for communication quality:
    "${transcript}"

    Return a JSON object matching this schema exactly:
    {
      "overallScore": number (0-100),
      "metrics": {
        "confidence": number (0-100),
        "fluency": number (0-100),
        "speakingSpeed": number (words per minute),
        "fillerWords": number (count of filler words like um, like, etc),
        "grammar": number (0-100),
        "pronunciation": number (0-100),
        "vocabulary": number (0-100),
        "tone": number (0-100),
        "clarity": number (0-100),
        "eyeContact": number (0-100),
        "facialEngagement": number (0-100)
      },
      "feedback": "string",
      "suggestions": ["string"]
    }`;

    const result = await model.generateContent(prompt);
    return safeParseJSON(result.response.text());
  } catch (error) {
    console.error("Gemini analyzeSpeech failed. Falling back to mock:", error);
    return mockSpeechAnalysis(transcript);
  }
};

exports.generateGDResponse = async (topic, messages, speechMetrics = null) => {
  if (!genAI) return mockGDDiscussion(topic, messages, speechMetrics);

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const messagesJson = JSON.stringify(messages);
    const isFinal = messages.length >= 6;
    const speechMetricsContext = speechMetrics
      ? `User Spoken Speech Delivery Telemetry: Average Speaking Pace: ${speechMetrics.avgWpm || 140} WPM, Total Fillers: ${speechMetrics.totalFillers || 0}, Fillers Detected: ${JSON.stringify(speechMetrics.fillerList || [])}, Spoken Turns: ${speechMetrics.spokenTurnsCount || 0}.`
      : "User participated via voice speech recognition / text input.";

    const prompt = `You are orchestrating an AI Group Discussion Boardroom Trainer.
    Topic: "${topic}"
    Discussion History: ${messagesJson}
    ${speechMetricsContext}

    Choose one of the 4 virtual participants (with different personalities and names: Siddharth - Visionary, Ananya - Data Critic, Rohan - Mediator, Elena - Challenger) who hasn't spoken in the last turn. Generate their natural conversational response to the ongoing discussion.
    
    If the history contains 6 or more turns (isFinal = ${isFinal}), thoroughly evaluate the user's performance across BOTH:
    1. Strategic Group Discussion Criteria: Collaboration, Argument Quality, Leadership, and Participation.
    2. Spoken Vocal Delivery Criteria: Speaking pace (WPM), filler words count and list, fluency score, vocal confidence, and clarity.

    Return a JSON object matching this schema exactly:
    {
      "sender": "string (name of virtual participant)",
      "avatar": "string (e.g. avatar2, avatar3, avatar4, avatar5)",
      "content": "string (their spoken response in discussion)",
      "analysis": null OR {
        "overallScore": number (0-100),
        "collabScore": number (0-100),
        "argumentQuality": number (0-100),
        "leadershipScore": number (0-100),
        "participationPercent": number (0-100),
        "speechMetrics": {
          "speakingPaceWPM": number (words per minute, e.g. 135-160),
          "paceStatus": "string (e.g. Optimal Cadence (130-165 WPM), Slightly Rushed, or Deliberate)",
          "fillerWordsCount": number,
          "fillerWordsList": ["string"],
          "fluencyScore": number (0-100),
          "vocalConfidence": number (0-100),
          "clarity": number (0-100)
        },
        "feedback": "string (constructive feedback analyzing both boardroom strategy and spoken delivery)",
        "suggestions": ["string (3 actionable tips addressing speech pace, fillers, or debate posture)"]
      }
    }`;

    const result = await model.generateContent(prompt);
    return safeParseJSON(result.response.text());
  } catch (error) {
    console.error("Gemini GD response failed. Falling back to mock:", error);
    return mockGDDiscussion(topic, messages, speechMetrics);
  }
};

exports.analyzePublicSpeaking = async (text) => {
  if (!genAI) return mockPublicSpeaking(text);

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `Evaluate this live public speech performance & spoken script:
    "${text}"

    Analyze the speaker's vocal delivery, confidence, clarity, structure, and mistakes made in speech (filler words, informal phrasing, weak qualifiers, run-on sentences).
    Provide precise corrected sentences with coaching reasons.

    Return a JSON object matching this schema exactly:
    {
      "overallScore": number (0-100),
      "metrics": {
        "voiceModulation": number (0-100),
        "confidence": number (0-100),
        "clarity": number (0-100),
        "structure": number (0-100),
        "audienceEngagement": number (0-100),
        "speakingPace": number (words per minute),
        "persuasiveness": number (0-100)
      },
      "mistakesAndCorrections": [
        {
          "type": "string (e.g. Filler Word, Weak Qualifier, Run-on Sentence, Informal Phrasing)",
          "spoken": "string (exact or representative spoken phrase with mistake)",
          "correction": "string (improved professional spoken sentence)",
          "reason": "string (explanation of why it was a mistake and how the correction improves it)"
        }
      ],
      "strengths": ["string"],
      "weaknesses": ["string"],
      "improvementRoadmap": [
        { "phase": "string", "goal": "string" }
      ]
    }`;

    const result = await model.generateContent(prompt);
    return safeParseJSON(result.response.text());
  } catch (error) {
    console.error("Gemini Public Speaking failed. Falling back to mock:", error);
    return mockPublicSpeaking(text);
  }
};

exports.evaluatePresentation = async (title, slideCount, rawTextContent = "", spokenTranscript = "") => {
  if (!genAI) return mockPresentationEvaluation(title, slideCount, rawTextContent, spokenTranscript);

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `Evaluate this live presentation deck & spoken speech performance:
    Presentation Title: "${title}"
    Slide Count: ${slideCount}
    Slide Content/Outline: "${rawTextContent}"
    Presenter Spoken Transcript: "${spokenTranscript}"

    Analyze the speaker's oral delivery, mistakes made in speech (filler words, informal phrasing, grammar, hesitations, alignment with slide content), and provide precise corrections.

    Return a JSON object matching this schema exactly:
    {
      "overallScore": number (0-100),
      "scores": {
        "design": number (0-100),
        "readability": number (0-100),
        "structure": number (0-100),
        "professionalism": number (0-100),
        "hierarchy": number (0-100),
        "effectiveness": number (0-100),
        "speechClarity": number (0-100),
        "slideAlignment": number (0-100)
      },
      "speakerNotes": [
        { "slideNumber": number, "notes": "string" }
      ],
      "presentationScript": "string",
      "mistakesAndCorrections": [
        {
          "type": "string (e.g. Filler Word, Informal Phrasing, Grammar Error, Pacing)",
          "spoken": "string (exact or representative spoken phrase with mistake)",
          "correction": "string (improved professional spoken sentence)",
          "reason": "string (explanation of why it was a mistake and how the correction improves it)"
        }
      ],
      "expectedQuestions": [
        { "question": "string", "suggestedAnswer": "string" }
      ],
      "suggestions": ["string"]
    }`;

    const result = await model.generateContent(prompt);
    return safeParseJSON(result.response.text());
  } catch (error) {
    console.error("Gemini Presentation failed. Falling back to mock:", error);
    return mockPresentationEvaluation(title, slideCount, rawTextContent, spokenTranscript);
  }
};

exports.assistEmail = async (originalContent, fromTone, toTone) => {
  if (!genAI) return mockEmailConversion(originalContent, fromTone, toTone);

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `Convert this email text:
    "${originalContent}"
    From tone: "${fromTone}"
    To tone: "${toTone}"

    Return a JSON object matching this schema exactly:
    {
      "convertedContent": "string",
      "grammarErrors": [
        { "error": "string", "correction": "string", "explanation": "string" }
      ],
      "suggestions": ["string"]
    }`;

    const result = await model.generateContent(prompt);
    return safeParseJSON(result.response.text());
  } catch (error) {
    console.error("Gemini Email failed. Falling back to mock:", error);
    return mockEmailConversion(originalContent, fromTone, toTone);
  }
};

exports.generateInterviewQuestions = async (jobTitle) => {
  if (!genAI) return mockInterviewQuestions(jobTitle);

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `Generate exactly 4 interview questions for a candidate applying to the position of: "${jobTitle}".
    Return a JSON array of strings:
    [
      "question 1",
      "question 2",
      "question 3",
      "question 4"
    ]`;

    const result = await model.generateContent(prompt);
    return safeParseJSON(result.response.text());
  } catch (error) {
    console.error("Gemini Interview Questions failed. Falling back to mock:", error);
    return mockInterviewQuestions(jobTitle);
  }
};

exports.evaluateInterview = async (jobTitle, questions, answers) => {
  if (!genAI) return mockInterviewEvaluation(jobTitle, questions, answers);

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const questionsJson = JSON.stringify(questions);
    const answersJson = JSON.stringify(answers);

    const prompt = `Evaluate mock interview answers for job title: "${jobTitle}".
    Questions: ${questionsJson}
    Answers: ${answersJson}

    Return a JSON object matching this schema exactly:
    {
      "overallScore": number (0-100),
      "scores": {
        "confidence": number (0-100),
        "professionalism": number (0-100),
        "clarity": number (0-100),
        "vocabulary": number (0-100),
        "bodyLanguage": number (0-100)
      },
      "feedback": "string",
      "readinessScore": number (0-100),
      "suggestions": ["string"]
    }`;

    const result = await model.generateContent(prompt);
    return safeParseJSON(result.response.text());
  } catch (error) {
    console.error("Gemini Interview evaluation failed. Falling back to mock:", error);
    return mockInterviewEvaluation(jobTitle, questions, answers);
  }
};

exports.debateRound = async (topic, history) => {
  if (!genAI) return mockDebateResponse(topic, history);

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const isFinal = history.length >= 5;
    const historyJson = JSON.stringify(history);

    const prompt = `You are an intelligent debate opponent.
    Topic: "${topic}"
    Debate History: ${historyJson}

    Respond with your next counterargument.
    If the history contains 5 or more turns (isFinal = ${isFinal}), evaluate the user's critical thinking, persuasion, logic, and rebuttal strength, and generate an "analysis" node.

    Return a JSON object matching this schema exactly:
    {
      "content": "string (AI's next counterargument response)",
      "analysis": null OR {
        "overallScore": number (0-100),
        "metrics": {
          "criticalThinking": number (0-100),
          "persuasion": number (0-100),
          "logicScore": number (0-100),
          "counterStrength": number (0-100)
        },
        "feedback": "string",
        "leaderboardPoints": number
      }
    }`;

    const result = await model.generateContent(prompt);
    return safeParseJSON(result.response.text());
  } catch (error) {
    console.error("Gemini Debate failed. Falling back to mock:", error);
    return mockDebateResponse(topic, history);
  }
};
