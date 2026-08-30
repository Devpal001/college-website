import { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, X, Sparkles, Bot } from 'lucide-react';
import { api } from '../lib/api';

export default function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      fetchSuggestions();
      // Add welcome message if no messages
      if (messages.length === 0) {
        setMessages([
          {
            role: 'assistant',
            content: "Hello! I'm your college AI assistant. I can help you with information about your attendance, marks, timetable, announcements, and college updates. How can I help you today?"
          }
        ]);
      }
    }
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchSuggestions = async () => {
    try {
      const response = await api.get('/assistant/suggestions');
      setSuggestions(response.suggestions || []);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    }
  };

  const handleSendMessage = async (message) => {
    if (!message.trim()) return;

    const userMessage = message.trim();
    setInputValue('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const response = await api.post('/assistant/chat', {
        message: userMessage,
        conversationHistory: messages
      });

      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: response.response,
        sources: response.sources
      }]);
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "I'm sorry, I encountered an error. Please try again later."
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    handleSendMessage(suggestion);
  };

  const formatSource = (source) => {
    return (
      <div className="mt-2 p-2 bg-bg-soft rounded-soft text-xs">
        <div className="font-medium text-text-main">{source.title}</div>
        <div className="text-text-muted">
          Source: {source.source} • {new Date(source.published).toLocaleDateString()}
        </div>
        {source.url && (
          <a 
            href={source.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            View original
          </a>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Floating Chat Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-24 right-6 z-50 p-4 rounded-full shadow-soft-lg transition-all duration-300 ${
          isOpen ? 'bg-primary text-white scale-0' : 'bg-primary text-white hover:bg-primary-dark hover:scale-110'
        }`}
        aria-label="Open AI Assistant"
      >
        <Bot className="w-6 h-6" />
      </button>

      {/* Chat Window */}
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="fixed bottom-24 right-6 w-96 max-h-[600px] bg-surface rounded-soft-lg shadow-soft-lg z-50 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-black/5 flex items-center justify-between bg-primary text-white">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                <h3 className="font-semibold">College AI Assistant</h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-white/20 rounded-soft transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] p-3 rounded-soft ${
                      message.role === 'user'
                        ? 'bg-primary text-white'
                        : 'bg-bg-soft text-text-main'
                    }`}
                  >
                    <div className="text-sm">{message.content}</div>
                    {message.sources && message.sources.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {message.sources.map((source, idx) => (
                          <div key={idx}>{formatSource(source)}</div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-bg-soft p-3 rounded-soft">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Suggestions */}
            {suggestions.length > 0 && messages.length <= 1 && (
              <div className="p-3 border-t border-black/5">
                <p className="text-xs text-text-muted mb-2">Suggested questions:</p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="text-xs px-3 py-1 bg-bg-soft hover:bg-primary hover:text-white rounded-full transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input */}
            <div className="p-4 border-t border-black/5">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage(inputValue);
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Ask about your college..."
                  className="flex-1 px-4 py-2 rounded-soft bg-bg-soft border border-transparent focus:border-primary outline-none transition"
                  disabled={loading}
                />
                <button
                  type="submit"
                  disabled={loading || !inputValue.trim()}
                  className="p-2 bg-primary text-white rounded-soft hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </div>
          </div>
        </>
      )}
    </>
  );
}