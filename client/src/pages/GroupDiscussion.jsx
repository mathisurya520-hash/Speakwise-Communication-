import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { AuthContext } from '../context/AuthContext';
import { 
  Sparkles, MessageSquare, Send, Award, Users, RefreshCw, AlertCircle, 
  Mic, MicOff, Volume2, VolumeX, Activity, Gauge, CheckCircle, Radio, Clock
} from 'lucide-react';
import confetti from 'canvas-confetti';

const GroupDiscussion = () => {
  const { token, updateLocalUser, API_URL } = useContext(AuthContext);
  const [topic, setTopic] = useState('');
  const [sessionActive, setSessionActive] = useState(false);
  const [messages, setMessages] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [botTyping, setBotTyping] = useState(false);
  const [activeSpeaker, setActiveSpeaker] = useState(null); // name of who is currently speaking
  const [report, setReport] = useState(null);
  const [reportTab, setReportTab] = useState('strategy'); // 'strategy' or 'speech'
  const [error, setError] = useState('');

  // Audio & Voice States
  const [isRecording, setIsRecording] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [speechDuration, setSpeechDuration] = useState(0);
  const [liveWpm, setLiveWpm] = useState(0);
  const [liveFillers, setLiveFillers] = useState([]);

  // Accumulated Session Speech Telemetry
  const [sessionSpeechStats, setSessionSpeechStats] = useState({
    totalWords: 0,
    totalDurationSec: 0,
    totalFillers: 0,
    fillerList: [],
    spokenTurnsCount: 0,
    avgWpm: 140
  });

  // Refs
  const chatEndRef = useRef(null);
  const canvasRef = useRef(null);
  const recognitionRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const audioStreamRef = useRef(null);
  const animationFrameRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const speechStartTimestampRef = useRef(null);
  const ttsEnabledRef = useRef(ttsEnabled);
  ttsEnabledRef.current = ttsEnabled;

  const topics = [
    "Will artificial intelligence completely replace creative professional writing?",
    "Should cryptocurrency and digital finance be heavily regulated by global entities?",
    "Is space exploration funding justified when earth is facing climate emergencies?",
    "Does remote work stifle long-term corporate collaboration and individual growth?"
  ];

  const participants = [
    { name: "Siddharth (Visionary)", role: "Visionary", avatar: "avatar2", bg: "bg-cyan-950/20 text-cyan-400 border-cyan-500/20", pitch: 1.0, rate: 1.0 },
    { name: "Ananya (Data Critic)", role: "Data Critic", avatar: "avatar3", bg: "bg-purple-950/20 text-purple-400 border-purple-500/20", pitch: 1.1, rate: 1.05 },
    { name: "Rohan (Mediator)", role: "Mediator", avatar: "avatar4", bg: "bg-emerald-950/20 text-emerald-400 border-emerald-500/20", pitch: 0.95, rate: 0.95 },
    { name: "Elena (Challenger)", role: "Challenger", avatar: "avatar5", bg: "bg-amber-950/20 text-amber-400 border-amber-500/20", pitch: 1.15, rate: 1.1 }
  ];

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, botTyping, isRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecordingCleanup();
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Setup Web Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        let interimText = '';
        let finalText = '';

        for (let i = 0; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalText += event.results[i][0].transcript + ' ';
          } else {
            interimText += event.results[i][0].transcript;
          }
        }

        const combinedText = (finalText + interimText).trim();
        setUserInput(combinedText);

        // Compute live speech metrics
        const words = combinedText.split(/\s+/).filter(Boolean).length;
        const elapsedSec = speechStartTimestampRef.current 
          ? Math.max(1, (Date.now() - speechStartTimestampRef.current) / 1000) 
          : 1;
        const currentWpm = Math.round((words / (elapsedSec / 60)));
        setLiveWpm(currentWpm);

        const fillerMatches = combinedText.match(/\b(um|uh|like|basically|you know|so|actually|literally)\b/gi) || [];
        setLiveFillers(Array.from(new Set(fillerMatches.map(f => f.toLowerCase()))));
      };

      recognition.onerror = (e) => {
        console.warn("Speech recognition notice:", e.error);
        if (e.error === 'not-allowed') {
          setError('Microphone access was denied. Please grant microphone permissions in browser.');
          stopRecording();
        }
      };

      recognition.onend = () => {
        // If still flagged as recording, user might have paused briefly
        if (isRecording) {
          try { recognition.start(); } catch (err) {}
        }
      };

      recognitionRef.current = recognition;
    }
  }, [isRecording]);

  // Bot Speech Synthesis (TTS)
  const speakBotText = useCallback((senderName, text) => {
    if (!ttsEnabledRef.current || !('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel(); // Stop any pending speech
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Pick participant voice settings
    const participant = participants.find(p => senderName.includes(p.role) || senderName.includes(p.name.split(' ')[0]));
    utterance.pitch = participant ? participant.pitch : 1.0;
    utterance.rate = participant ? participant.rate : 1.0;

    // Attempt to pick a distinct voice if available
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      if (participant && (participant.role === 'Data Critic' || participant.role === 'Challenger')) {
        const femaleVoice = voices.find(v => /female|woman|zira|samantha/i.test(v.name));
        if (femaleVoice) utterance.voice = femaleVoice;
      } else {
        const maleVoice = voices.find(v => /male|man|david|daniel/i.test(v.name));
        if (maleVoice) utterance.voice = maleVoice;
      }
    }

    setActiveSpeaker(senderName);
    utterance.onend = () => setActiveSpeaker(null);
    utterance.onerror = () => setActiveSpeaker(null);

    window.speechSynthesis.speak(utterance);
  }, [participants]);

  // Web Audio Waveform Visualizer
  const drawWaveform = (analyser, dataArray, bufferLength) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    const render = () => {
      animationFrameRef.current = requestAnimationFrame(render);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, width, height);

      const barWidth = (width / bufferLength) * 2.8;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = (dataArray[i] / 255) * height;

        const gradient = ctx.createLinearGradient(0, height, 0, 0);
        gradient.addColorStop(0, '#00f0ff');
        gradient.addColorStop(1, '#a855f7');

        ctx.fillStyle = gradient;
        ctx.fillRect(x, height - barHeight, barWidth - 1, barHeight);
        x += barWidth;
      }
    };
    render();
  };

  const startRecording = async () => {
    setError('');
    setIsRecording(true);
    setSpeechDuration(0);
    setLiveWpm(0);
    setLiveFillers([]);
    speechStartTimestampRef.current = Date.now();
    setActiveSpeaker('You (Speaker)');

    // Start timer
    timerIntervalRef.current = setInterval(() => {
      setSpeechDuration(prev => prev + 1);
    }, 1000);

    // Start Speech Recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.warn("Recognition already active", err);
      }
    } else {
      setError("Speech recognition is not supported in this browser. You can type your response instead.");
    }

    // Start Web Audio API for visualizer
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioContext();
      audioContextRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      drawWaveform(analyser, dataArray, bufferLength);
    } catch (err) {
      console.warn("Audio waveform capture notice:", err);
    }
  };

  const stopRecordingCleanup = () => {
    setIsRecording(false);
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(t => t.stop());
      audioStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (err) {}
    }
    setActiveSpeaker(null);
  };

  const stopRecording = () => {
    stopRecordingCleanup();
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const startDiscussion = async (selectedTopic) => {
    setTopic(selectedTopic);
    setMessages([]);
    setReport(null);
    setError('');
    setSessionActive(true);
    setBotTyping(true);
    setUserInput('');
    setSessionSpeechStats({
      totalWords: 0,
      totalDurationSec: 0,
      totalFillers: 0,
      fillerList: [],
      spokenTurnsCount: 0,
      avgWpm: 140
    });

    try {
      const res = await fetch(`${API_URL}/modules/gd/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ topic: selectedTopic, messages: [] })
      });

      const data = await res.json();
      if (res.ok) {
        setMessages([{
          sender: data.reply.sender,
          avatar: data.reply.avatar,
          content: data.reply.content,
          timestamp: new Date()
        }]);

        // Bot voice synthesis
        speakBotText(data.reply.sender, data.reply.content);
      } else {
        setError(data.message || 'Error launching trainer.');
      }
    } catch (err) {
      setError('Connection to the MERN backend failed.');
    } finally {
      setBotTyping(false);
    }
  };

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    if (!userInput.trim() || botTyping) return;

    // If still recording, stop and commit
    if (isRecording) {
      stopRecording();
    }

    const currentText = userInput.trim();
    const wordsInTurn = currentText.split(/\s+/).filter(Boolean).length;
    const durationInTurn = speechDuration > 0 ? speechDuration : Math.max(3, Math.round(wordsInTurn / 2.3));
    const turnFillers = currentText.match(/\b(um|uh|like|basically|you know|so|actually|literally)\b/gi) || [];
    const turnWpm = Math.round((wordsInTurn / (durationInTurn / 60))) || 140;

    // Update accumulated session speech telemetry
    const updatedTotalWords = sessionSpeechStats.totalWords + wordsInTurn;
    const updatedTotalDuration = sessionSpeechStats.totalDurationSec + durationInTurn;
    const updatedTotalFillers = sessionSpeechStats.totalFillers + turnFillers.length;
    const updatedFillerList = Array.from(new Set([...sessionSpeechStats.fillerList, ...turnFillers.map(f => f.toLowerCase())]));
    const updatedSpokenTurns = sessionSpeechStats.spokenTurnsCount + 1;
    const computedAvgWpm = Math.round((updatedTotalWords / (Math.max(1, updatedTotalDuration) / 60)));

    const updatedStats = {
      totalWords: updatedTotalWords,
      totalDurationSec: updatedTotalDuration,
      totalFillers: updatedTotalFillers,
      fillerList: updatedFillerList,
      spokenTurnsCount: updatedSpokenTurns,
      avgWpm: computedAvgWpm > 0 ? computedAvgWpm : turnWpm
    };
    setSessionSpeechStats(updatedStats);

    const userMsg = {
      sender: 'user',
      avatar: 'avatar1',
      content: currentText,
      timestamp: new Date(),
      speechMetrics: {
        wpm: turnWpm,
        durationSec: durationInTurn,
        fillersCount: turnFillers.length
      }
    };

    const updatedHistory = [...messages, userMsg];
    setMessages(updatedHistory);
    setUserInput('');
    setLiveWpm(0);
    setLiveFillers([]);
    setSpeechDuration(0);
    setBotTyping(true);

    try {
      const payload = updatedHistory.map(m => ({
        sender: m.sender,
        content: m.content
      }));

      const res = await fetch(`${API_URL}/modules/gd/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          topic, 
          messages: payload,
          speechMetrics: updatedStats
        })
      });

      const data = await res.json();
      if (res.ok) {
        setMessages(prev => [...prev, {
          sender: data.reply.sender,
          avatar: data.reply.avatar,
          content: data.reply.content,
          timestamp: new Date()
        }]);

        speakBotText(data.reply.sender, data.reply.content);

        if (data.report) {
          setReport(data.report);
          setSessionActive(false);
          if (data.user) {
            updateLocalUser(data.user);
          }
          confetti({
            particleCount: 90,
            spread: 60,
            origin: { y: 0.8 }
          });
        }
      } else {
        setError(data.message || 'AI processing failure.');
      }
    } catch (err) {
      setError('MERN server timeout.');
    } finally {
      setBotTyping(false);
    }
  };

  const userMessagesCount = messages.filter(m => m.sender === 'user').length;
  const remainingTurns = Math.max(0, 6 - userMessagesCount);

  return (
    <div className="max-w-5xl mx-auto px-4 py-24 space-y-8">
      {/* Title & Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-wider text-glow-cyan text-white uppercase font-display flex items-center justify-center gap-2">
          Module 2: AI Group Discussion Boardroom
        </h1>
        <p className="text-xs text-gray-400 font-mono mt-1 uppercase tracking-widest flex items-center justify-center gap-2">
          <span>Multi-Turn Voice Discussion Simulation</span>
          <span className="text-neonCyan">&bull;</span>
          <span className="text-neonPurple font-bold">Real-time Speech Delivery Analysis</span>
        </p>
      </div>

      {/* Topic Selection View */}
      {!sessionActive && !report && (
        <div className="glass-panel p-8 rounded-3xl border border-white/10 max-w-2xl mx-auto space-y-6">
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <h3 className="text-base font-bold text-white font-display uppercase tracking-wider flex items-center gap-2">
              <Sparkles size={16} className="text-neonCyan" />
              Select a Discussion Topic
            </h3>
            <span className="text-[10px] uppercase font-mono px-2.5 py-1 rounded-full bg-cyan-950/40 text-cyan-400 border border-cyan-500/30">
              Voice & Speech Enabled
            </span>
          </div>

          <div className="space-y-3">
            {topics.map((t, i) => (
              <button
                key={i}
                onClick={() => startDiscussion(t)}
                className="w-full text-left bg-black/40 border border-white/5 hover:border-neonCyan/40 hover:bg-white/5 p-4 rounded-xl text-xs text-gray-300 transition-all font-mono leading-relaxed block group"
              >
                <div className="flex items-center justify-between">
                  <span className="group-hover:text-white transition-colors">{t}</span>
                  <Radio size={14} className="text-gray-500 group-hover:text-neonCyan shrink-0 ml-3" />
                </div>
              </button>
            ))}
          </div>

          <div className="p-4 rounded-xl bg-neonCyan/5 border border-neonCyan/20 text-xs text-gray-300 font-mono space-y-1">
            <span className="text-neonCyan font-bold flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
              <Mic size={14} /> Speech Analysis Highlights:
            </span>
            <p className="text-[11px] text-gray-400">
              Speak your arguments live using the microphone. SpeakWise captures your vocal cadence, words per minute (WPM), filler word usage, and leadership assertiveness in the boardroom.
            </p>
          </div>
        </div>
      )}

      {/* Active Boardroom Session */}
      {sessionActive && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Virtual Boardroom Participants Sidebar */}
          <div className="lg:col-span-4 glass-panel p-5 rounded-2xl border border-white/10 h-fit space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="text-xs font-bold font-display uppercase tracking-wider text-neonCyan flex items-center gap-2">
                <Users size={16} />
                Boardroom Participants
              </h3>
              <button
                onClick={() => setTtsEnabled(!ttsEnabled)}
                className={`p-1.5 rounded-lg border text-[10px] font-mono flex items-center gap-1 transition-colors ${
                  ttsEnabled 
                    ? 'bg-neonCyan/10 border-neonCyan/30 text-neonCyan' 
                    : 'bg-black/40 border-white/10 text-gray-400'
                }`}
                title={ttsEnabled ? "Mute Bot Speech Synthesis" : "Enable Bot Speech Synthesis"}
              >
                {ttsEnabled ? <Volume2 size={12} /> : <VolumeX size={12} />}
                <span>{ttsEnabled ? 'Voices ON' : 'Muted'}</span>
              </button>
            </div>
            
            <div className="space-y-3">
              {participants.map(p => {
                const isSpeaking = activeSpeaker === p.name;
                return (
                  <div 
                    key={p.name} 
                    className={`flex items-center justify-between p-3 border rounded-xl transition-all ${p.bg} ${
                      isSpeaking ? 'ring-2 ring-neonCyan shadow-[0_0_15px_rgba(0,240,255,0.3)] animate-pulse' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-black/40 flex items-center justify-center font-display font-semibold text-xs border border-white/10 uppercase">
                        {p.avatar.replace('avatar', '#')}
                      </div>
                      <div>
                        <span className="text-xs font-semibold block">{p.name}</span>
                        <span className="text-[9px] uppercase font-mono text-gray-400">
                          {isSpeaking ? '🎙️ Speaking...' : 'AI Simulated Persona'}
                        </span>
                      </div>
                    </div>
                    {isSpeaking && (
                      <span className="text-[10px] font-mono text-neonCyan animate-bounce">
                        <Activity size={14} />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            
            {/* Session Turn Progress */}
            <div className="bg-black/30 p-3.5 rounded-xl border border-white/5 space-y-2">
              <div className="flex justify-between items-center text-[10px] font-mono">
                <span className="text-gray-400 uppercase">Boardroom Turns</span>
                <span className="text-neonCyan font-bold">{userMessagesCount} / 6 Arguments</span>
              </div>
              <div className="w-full bg-black/50 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-neonCyan to-neonPurple h-full transition-all duration-300"
                  style={{ width: `${(userMessagesCount / 6) * 100}%` }}
                ></div>
              </div>
              <p className="text-[9px] text-gray-500 font-mono">
                {remainingTurns > 0 
                  ? `Discussion concludes after ${remainingTurns} more user argument${remainingTurns > 1 ? 's' : ''}.`
                  : 'Finalizing session evaluation report...'}
              </p>
            </div>
          </div>

          {/* Main Chat & Voice Interaction Area */}
          <div className="lg:col-span-8 glass-panel rounded-2xl border border-white/10 flex flex-col h-[540px] overflow-hidden">
            {/* Room Header */}
            <div className="p-4 bg-black/30 border-b border-white/5 flex items-center justify-between">
              <div className="truncate pr-4">
                <span className="text-[9px] uppercase font-mono text-gray-400 block">Current Agenda Topic</span>
                <h4 className="text-xs font-bold text-white truncate font-mono mt-0.5">{topic}</h4>
              </div>
              {isRecording && (
                <div className="flex items-center gap-2 bg-red-950/60 border border-red-500/40 text-red-300 px-3 py-1 rounded-full text-[10px] font-mono animate-pulse shrink-0">
                  <span className="w-2 h-2 rounded-full bg-red-500"></span>
                  <span>RECORDING ({speechDuration}s)</span>
                </div>
              )}
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 p-5 overflow-y-auto space-y-4">
              {messages.map((m, idx) => (
                <div
                  key={idx}
                  className={`flex gap-3 max-w-[85%] ${m.sender === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold font-display border border-white/10 uppercase shrink-0 ${
                    m.sender === 'user' ? 'bg-neonCyan text-black' : 'bg-black/40 text-neonPurple'
                  }`}>
                    {m.sender === 'user' ? 'U' : m.sender.substring(0, 1)}
                  </div>
                  <div className={`p-4 rounded-2xl text-xs leading-relaxed font-mono ${
                    m.sender === 'user'
                      ? 'bg-gradient-to-tr from-cyan-950/80 to-blue-950/80 text-white rounded-tr-none border border-neonCyan/30 shadow-[0_0_15px_rgba(0,240,255,0.1)]'
                      : 'bg-black/40 text-gray-300 rounded-tl-none border border-white/5'
                  }`}>
                    <div className="flex items-center justify-between mb-1.5 gap-2">
                      <span className="text-[10px] font-bold text-gray-400 font-display uppercase tracking-wider">
                        {m.sender === 'user' ? 'You (Speaker)' : m.sender}
                      </span>
                      {m.speechMetrics && (
                        <span className="text-[9px] text-neonCyan bg-cyan-950/60 px-2 py-0.5 rounded-full border border-cyan-500/30">
                          {m.speechMetrics.wpm} WPM {m.speechMetrics.fillersCount > 0 && `• ${m.speechMetrics.fillersCount} filler`}
                        </span>
                      )}
                    </div>
                    "{m.content}"
                  </div>
                </div>
              ))}

              {botTyping && (
                <div className="flex gap-3 max-w-[80%] items-center text-xs font-mono text-gray-400 bg-black/20 p-3 rounded-xl border border-white/5">
                  <RefreshCw size={14} className="animate-spin text-neonPurple" />
                  <span>Participant is assessing argument and formulating reply...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Live Audio Visualizer Banner (Shown while speaking) */}
            {isRecording && (
              <div className="p-3 bg-black/60 border-t border-neonCyan/30 space-y-2">
                <div className="flex justify-between items-center text-[10px] font-mono">
                  <span className="text-neonCyan font-bold flex items-center gap-1.5">
                    <Activity size={12} className="animate-pulse" /> Live Speech Capture Active
                  </span>
                  <div className="flex items-center gap-3 text-gray-400">
                    <span>Pace: <strong className="text-white">{liveWpm} WPM</strong></span>
                    <span>Fillers: <strong className={liveFillers.length > 0 ? "text-amber-400" : "text-emerald-400"}>
                      {liveFillers.length} {liveFillers.length > 0 ? `(${liveFillers.join(', ')})` : ''}
                    </strong></span>
                  </div>
                </div>
                <canvas 
                  ref={canvasRef} 
                  width={600} 
                  height={32} 
                  className="w-full h-8 rounded-lg bg-black/50 border border-white/5"
                />
              </div>
            )}

            {/* Speech & Text Input Area */}
            <form onSubmit={handleSend} className="p-4 bg-black/40 border-t border-white/5 flex gap-2 items-center">
              {/* Mic Toggle Button */}
              <button
                type="button"
                onClick={toggleRecording}
                disabled={botTyping}
                className={`p-3 rounded-xl border transition-all flex items-center justify-center shrink-0 ${
                  isRecording 
                    ? 'bg-red-600 text-white border-red-400 shadow-[0_0_15px_rgba(239,68,68,0.5)] animate-pulse cursor-pointer' 
                    : 'bg-white/5 hover:bg-white/10 text-neonCyan border-neonCyan/30 hover:border-neonCyan hover:shadow-[0_0_12px_rgba(0,240,255,0.3)] cursor-pointer'
                }`}
                title={isRecording ? "Click to Stop Speaking" : "Click to Speak (Speech-to-Text & Speech Analysis)"}
              >
                {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
              </button>

              {/* Text Input / Live Speech Transcription Display */}
              <input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder={
                  isRecording 
                    ? "Listening to your voice... Speak your argument..." 
                    : botTyping 
                    ? "Please wait for virtual participants..." 
                    : "Speak using mic or type your debate argument..."
                }
                disabled={botTyping}
                className="flex-1 bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-neonCyan transition-colors font-mono"
              />

              {/* Send Button */}
              <button
                type="submit"
                disabled={botTyping || !userInput.trim()}
                className="bg-gradient-to-r from-neonCyan to-neonPurple text-white px-5 py-3 rounded-xl font-bold tracking-wider font-display uppercase hover:shadow-[0_0_15px_rgba(0,240,255,0.4)] cursor-pointer disabled:opacity-50 border-none shrink-0 transition-all flex items-center gap-1.5"
              >
                <Send size={14} />
                <span className="hidden sm:inline text-xs">Argue</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Dual-Dimension GD Evaluation Report */}
      {report && (
        <div className="glass-panel p-8 rounded-3xl border border-white/10 max-w-3xl mx-auto space-y-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-neonCyan/10 rounded-full blur-3xl pointer-events-none"></div>
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-white/5 pb-4 gap-4">
            <div className="flex items-center gap-2 text-neonCyan">
              <Award size={24} />
              <div>
                <h3 className="text-xl font-display font-bold uppercase tracking-wider text-white">
                  Boardroom Performance & Speech Report
                </h3>
                <span className="text-[10px] text-gray-400 font-mono">
                  Multi-Factor Evaluation • {report.title}
                </span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="text-[10px] uppercase font-mono text-gray-400 block">Overall Score</span>
              <span className="text-3xl font-bold text-neonCyan">{report.overallScore}/100</span>
            </div>
          </div>

          {/* Tab Navigation: Strategy vs Speech */}
          <div className="flex border-b border-white/10 text-xs font-mono">
            <button
              onClick={() => setReportTab('strategy')}
              className={`pb-3 px-4 font-bold uppercase tracking-wider transition-colors border-b-2 flex items-center gap-2 ${
                reportTab === 'strategy'
                  ? 'border-neonCyan text-neonCyan'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              <Users size={14} /> Boardroom Strategy
            </button>
            <button
              onClick={() => setReportTab('speech')}
              className={`pb-3 px-4 font-bold uppercase tracking-wider transition-colors border-b-2 flex items-center gap-2 ${
                reportTab === 'speech'
                  ? 'border-neonPurple text-neonPurple'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              <Gauge size={14} /> Speech & Vocal Delivery
            </button>
          </div>

          {/* TAB 1: BOARDROOM STRATEGY */}
          {reportTab === 'strategy' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="text-xs uppercase font-mono tracking-widest text-neonCyan font-bold">
                  Strategic Metrics Breakdown
                </h4>
                <div className="space-y-3">
                  {[
                    { label: "Collaboration & Synthesis", val: report.metrics?.collaboration || 85 },
                    { label: "Argument Depth & Quality", val: report.metrics?.argumentQuality || 82 },
                    { label: "Executive Leadership", val: report.metrics?.leadership || 80 },
                    { label: "Discussion Participation", val: report.metrics?.participation || 88 }
                  ].map((m, idx) => (
                    <div key={idx}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-300 font-mono">{m.label}</span>
                        <span className="font-bold text-white">{m.val}%</span>
                      </div>
                      <div className="w-full bg-black/40 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-neonCyan to-neonPurple h-full transition-all duration-500"
                          style={{ width: `${m.val}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-xs uppercase font-mono tracking-widest text-neonPurple font-bold">
                  AI Executive Feedback
                </h4>
                <p className="text-xs text-gray-300 leading-relaxed font-mono bg-black/25 p-4 rounded-xl border border-white/5">
                  "{report.feedback}"
                </p>
                <div className="space-y-2">
                  <span className="text-[10px] text-gray-400 font-mono uppercase tracking-wider block">Actionable Directives</span>
                  {report.suggestions?.map((s, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-gray-300 font-mono bg-black/20 p-2.5 rounded-lg border border-white/5">
                      <CheckCircle size={14} className="text-neonCyan shrink-0 mt-0.5" />
                      <span>{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SPEECH & VOCAL DELIVERY ANALYSIS */}
          {reportTab === 'speech' && (
            <div className="space-y-6">
              {/* Top Highlights Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-black/30 border border-white/5 space-y-1">
                  <span className="text-[10px] uppercase font-mono text-gray-400 block">Speaking Pace</span>
                  <div className="text-xl font-bold text-neonCyan font-mono">
                    {report.metrics?.speechMetrics?.speakingPaceWPM || sessionSpeechStats.avgWpm || 142} WPM
                  </div>
                  <span className="text-[10px] text-gray-400 font-mono block">
                    {report.metrics?.speechMetrics?.paceStatus || "Optimal Cadence (130-165 WPM)"}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-black/30 border border-white/5 space-y-1">
                  <span className="text-[10px] uppercase font-mono text-gray-400 block">Filler Words</span>
                  <div className="text-xl font-bold text-amber-400 font-mono">
                    {report.metrics?.speechMetrics?.fillerWordsCount ?? sessionSpeechStats.totalFillers} Detected
                  </div>
                  <span className="text-[10px] text-gray-400 font-mono truncate block">
                    {report.metrics?.speechMetrics?.fillerWordsList?.join(', ') || "None detected"}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-black/30 border border-white/5 space-y-1">
                  <span className="text-[10px] uppercase font-mono text-gray-400 block">Vocal Fluency</span>
                  <div className="text-xl font-bold text-neonPurple font-mono">
                    {report.metrics?.speechMetrics?.fluencyScore || 88}%
                  </div>
                  <span className="text-[10px] text-gray-400 font-mono block">
                    Smooth conversational transitions
                  </span>
                </div>
              </div>

              {/* Delivery Radar Bars */}
              <div className="space-y-3 bg-black/20 p-5 rounded-2xl border border-white/5">
                <h4 className="text-xs uppercase font-mono tracking-widest text-white font-bold mb-3 flex items-center gap-2">
                  <Activity size={14} className="text-neonCyan" /> Vocal Delivery Matrix
                </h4>
                {[
                  { label: "Vocal Confidence & Modulation", val: report.metrics?.speechMetrics?.vocalConfidence || 86 },
                  { label: "Pronunciation & Clarity", val: report.metrics?.speechMetrics?.clarity || 88 },
                  { label: "Turn Cadence Consistency", val: 84 }
                ].map((item, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-xs mb-1 font-mono">
                      <span className="text-gray-300">{item.label}</span>
                      <span className="text-neonCyan font-bold">{item.val}%</span>
                    </div>
                    <div className="w-full bg-black/50 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-neonCyan to-neonPurple h-full rounded-full transition-all duration-500"
                        style={{ width: `${item.val}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Speech Etiquette Tip */}
              <div className="p-4 rounded-xl bg-neonPurple/5 border border-neonPurple/20 text-xs font-mono text-gray-300 space-y-1">
                <span className="text-neonPurple font-bold uppercase tracking-wider text-[11px] block">
                  Executive Speech Coaching Tip:
                </span>
                <p className="text-[11px] text-gray-400">
                  In fast-paced discussions, silence is your ally. Taking a controlled 1-second pause before replying establishes rhetorical authority and eliminates instinctual filler sounds like "basically" or "um".
                </p>
              </div>
            </div>
          )}

          {/* Action Button */}
          <button
            onClick={() => {
              setReport(null);
              setSessionActive(false);
              setMessages([]);
            }}
            className="w-full bg-white/5 border border-white/10 hover:bg-white/10 text-white py-3.5 rounded-xl font-bold tracking-wider font-display uppercase transition-all cursor-pointer text-xs"
          >
            Launch New Boardroom Session
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-950/40 border border-red-500/30 text-red-300 text-xs rounded-xl flex items-center gap-2 max-w-md mx-auto">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export default GroupDiscussion;
