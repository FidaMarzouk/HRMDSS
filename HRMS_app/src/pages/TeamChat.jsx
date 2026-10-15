import { useState, useEffect, useRef } from 'react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

export default function ChatComponent() {
    const [employees, setEmployees] = useState([]);
    const [filteredEmployees, setFilteredEmployees] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [showOptions, setShowOptions] = useState(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [conversations, setConversations] = useState([]);
    const { user: currentUser } = useAuth();
    const socket = useSocket();
    const messageEndRef = useRef(null);
    const selectedUserRef = useRef(null);
    const messageInputRef = useRef(null); // Reference for message input
    
    // Initial data
    useEffect(() => {
      fetchEmployees();
      fetchConversations();
    }, []);

    // Tell the server the messages from this colleague have been read.
    const markConversationRead = (senderId) => {
      api.put('/api/chat/messages/read', { senderId }).catch(() => {});
    };
    
    // Update the ref whenever selectedUser changes
    useEffect(() => {
      selectedUserRef.current = selectedUser;
      
      // Focus on message input when selecting a user
      if (selectedUser && messageInputRef.current) {
        messageInputRef.current.focus();
      }
    }, [selectedUser]);
    
    // Scroll to bottom of messages when they change
    useEffect(() => {
      messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);
    
    // Filter employees when search query changes
    useEffect(() => {
      if (!searchQuery.trim()) {
        setFilteredEmployees(employees);
        return;
      }
      
      const query = searchQuery.toLowerCase();
      const filtered = employees.filter(emp => 
        emp.firstName?.toLowerCase().includes(query) || 
        emp.lastName?.toLowerCase().includes(query)
      );
      
      setFilteredEmployees(filtered);
    }, [searchQuery, employees]);
    
    // Real-time events on the shared, cookie-authenticated socket
    useEffect(() => {
      if (!socket || !currentUser) return undefined;

      socket.on('newMessage', handleNewMessage);
      socket.on('messageDeleted', handleMessageDeleted);
      socket.on('conversationDeleted', handleConversationDeleted);
      socket.on('messagesRead', handleMessagesRead);

      return () => {
        socket.off('newMessage', handleNewMessage);
        socket.off('messageDeleted', handleMessageDeleted);
        socket.off('conversationDeleted', handleConversationDeleted);
        socket.off('messagesRead', handleMessagesRead);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [socket, currentUser]);

    // Handle new message received from socket
    const handleNewMessage = (message) => {
      if (!currentUser) return;
      
      const currentSelectedUser = selectedUserRef.current;
      
      // Check if message involves the current user (as sender or receiver)
      const isCurrentUserInvolved = message.sender._id === currentUser._id || message.receiver._id === currentUser._id;
      
      // Check if message involves the selected user (as sender or receiver)
      const isSelectedUserInvolved = currentSelectedUser && 
        (message.sender._id === currentSelectedUser._id || message.receiver._id === currentSelectedUser._id);
      
      // Add message to the chat if it involves both current user and selected user
      if (isCurrentUserInvolved && isSelectedUserInvolved) {
        // The sender also receives their own message over the socket: avoid duplicates.
        setMessages((prevMessages) =>
          prevMessages.some((m) => m._id === message._id) ? prevMessages : [...prevMessages, message]
        );

        // If message is received by current user, mark it as read
        if (message.receiver._id === currentUser._id) {
          markConversationRead(currentSelectedUser._id);
        }
      }
      
      // Always update conversations to refresh unread counts
      fetchConversations();
    };
    
    // Handle message deletion event
    const handleMessageDeleted = ({ messageId }) => {
      setMessages((prevMessages) => prevMessages.filter(msg => msg._id !== messageId));
    };
    
    // Handle conversation deletion event
    const handleConversationDeleted = ({ userId }) => {
      const currentSelectedUser = selectedUserRef.current;
      if (currentSelectedUser && currentSelectedUser._id === userId) {
        setMessages([]); // Clear messages if current conversation is deleted
      }
      fetchConversations(); // Always fetch conversations to update unread counts
    };
    
    // Handle messages read event
    const handleMessagesRead = ({ userId }) => {
      // Update UI to show messages as read
      setConversations(prev => 
        prev.map(conv => 
          conv.userId === userId 
            ? { ...conv, unreadCount: 0 } 
            : conv
        )
      );
    };

    const fetchConversations = async () => {
      try {
        const res = await api.get('/api/chat/conversations');
        
        if (Array.isArray(res.data)) {
          setConversations(res.data);
        }
      } catch (error) {
        handleApiError(error);
      }
    };

    const fetchEmployees = async () => {
      try {
        const res = await api.get('/api/chat/users');
    
        if (Array.isArray(res.data)) {
          setEmployees(res.data);
          setFilteredEmployees(res.data); 
        } else {
          console.error('Unexpected response format:', res.data);
          setEmployees([]);
          setFilteredEmployees([]);
        }
      } catch (error) {
        handleApiError(error);
      }
    };
    
    const fetchMessages = async (userId) => {
      // Find the selected user object from employees array
      const userObj = employees.find(emp => emp._id === userId);
      setSelectedUser(userObj); // Store the full user object
      
      try {
        const res = await api.get(`/api/chat/messages/${userId}`);
        setMessages(res.data || []);
        
        // Update local unread counts
        setConversations(prev => 
          prev.map(conv => 
            conv.userId === userId 
              ? { ...conv, unreadCount: 0 } 
              : conv
          )
        );
        
      }  catch (error) {
        handleApiError(error);
        setMessages([]);
      }
    };

    // Expired sessions are redirected to login by the API client; just log the rest.
    const handleApiError = (error) => {
      console.error('API Error:', error);
    };

    const sendMessage = async (e) => {
      e.preventDefault(); 
      
      if (!newMessage.trim() || !selectedUser || !currentUser) return;
      
      try {
        const res = await api.post('/api/chat/messages', { receiverId: selectedUser._id, message: newMessage });
        setNewMessage('');
        if (res.data) {
          setMessages(prev => (prev.some((m) => m._id === res.data._id) ? prev : [...prev, res.data]));
        }
      } catch (error) {
        handleApiError(error);
      }
    };

    // Delete a single message
    const deleteMessage = async (messageId) => {
      try {
        await api.delete(`/api/chat/messages/${messageId}`);
        
        // Remove the message from the UI
        setMessages(prev => prev.filter(msg => msg._id !== messageId));
        setShowOptions(null); // Hide options menu
      } catch (error) {
        console.error('Error deleting message:', error);
        handleApiError(error);
      }
    };

    // Delete entire conversation
    const deleteConversation = async () => {
      if (!selectedUser) return;
      
      try {
        await api.delete(`/api/chat/conversations/${selectedUser._id}`);
        
        // Clear messages in the UI
        setMessages([]);
        setShowDeleteModal(false);
      } catch (error) {
        console.error('Error deleting conversation:', error);
        handleApiError(error);
      }
    };

    // Handle press Enter to send message
    const handleKeyPress = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        sendMessage(e);
      }
    };

    // Toggle message options menu
    const toggleMessageOptions = (messageId, e) => {
      e.stopPropagation();
      setShowOptions(showOptions === messageId ? null : messageId);
    };

    // Close options menu when clicking outside
    useEffect(() => {
      const handleClickOutside = () => setShowOptions(null);
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    // Get unread count for a user
    const getUnreadCount = (userId) => {
      const conversation = conversations.find(conv => conv.userId === userId);
      return conversation ? conversation.unreadCount : 0;
    };

    // Handle search input change
    const handleSearchChange = (e) => {
      setSearchQuery(e.target.value);
    };

    // Clear search
    const clearSearch = () => {
      setSearchQuery('');
    };

    const getSortedEmployees = () => {
      if (!Array.isArray(filteredEmployees) || !Array.isArray(conversations)) {
        return [];
      }
      
      // Create a copy of filteredEmployees to sort
      return [...filteredEmployees].sort((a, b) => {
        // Find unread counts for both employees
        const unreadCountA = getUnreadCount(a._id);
        const unreadCountB = getUnreadCount(b._id);
        
        // Sort by unread count (higher count first)
        return unreadCountB - unreadCountA;
      });
    };

    return (
      <div className="flex h-screen bg-sunk text-ink">
        {/* Employee list sidebar */}
        <div className="w-1/3 p-4 border-r border-line flex flex-col">
          <h2 className="text-lg font-bold mb-4">Employees</h2>
          
          {/* Search box */}
          <div className="mb-4 relative">
            <input
              type="text"
              className="w-full p-2 bg-panel border border-edge rounded text-ink focus:outline-none focus:ring-2 focus:ring-teal focus:border-transparent transition-all duration-200 placeholder:text-ink-3"
              placeholder="Search by name..."
              value={searchQuery}
              onChange={handleSearchChange}
            />
            {searchQuery && (
              <button
                className="absolute right-2 top-2 text-ink-2 hover:text-ink"
                onClick={clearSearch}
              >
                ✕
              </button>
            )}
          </div>
          
          {/* Employee list with scroll */}
          <div className="overflow-y-auto flex-1">
          {Array.isArray(filteredEmployees) && filteredEmployees.length > 0 ? (
           getSortedEmployees().map((emp) => {
                const unreadCount = getUnreadCount(emp._id);
                
                return (
                  <div 
                    key={emp._id} 
                    className={`p-3 mb-2 border-b border-line cursor-pointer flex items-center gap-3 hover:bg-sunk rounded transition-colors ${
                      selectedUser && selectedUser._id === emp._id ? 'bg-raise border-l-4 border-teal' : ''
                    }`}
                    onClick={() => fetchMessages(emp._id)}
                  >
                    <div className="w-10 h-10 rounded-full bg-teal flex items-center justify-center font-bold">
                      {emp.firstName ? emp.firstName.charAt(0) : ''}
                      {emp.lastName ? emp.lastName.charAt(0) : ''}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{emp.firstName} {emp.lastName}</p>
                      <p className="text-xs text-ink-2">{emp.role || 'Employee'}</p>
                    </div>
                    {unreadCount > 0 && (
                      <div className="bg-red text-on-accent rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold animate-pulse">
                        {unreadCount}
                      </div>
                    )}
                  </div>
                );
              })
            ) : searchQuery ? (
              <p className="text-ink-2">No employees match your search</p>
            ) : (
              <p className="text-ink-2">No employees found</p>
            )}
          </div>
        </div>

        {/* Chat area */}
        <div className="w-2/3 p-4 flex flex-col">
          {selectedUser ? (
            <>
              {/* Chat header */}
              <div className="pb-4 mb-4 border-b border-line flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-full bg-teal flex items-center justify-center font-bold mr-3">
                    {selectedUser.firstName ? selectedUser.firstName.charAt(0) : ''}
                    {selectedUser.lastName ? selectedUser.lastName.charAt(0) : ''}
                  </div>
                  <div>
                    <h3 className="font-bold">{selectedUser.firstName} {selectedUser.lastName}</h3>
                    <p className="text-xs text-ink-2">{selectedUser.role || 'Employee'}</p>
                  </div>
                </div>
                
                {/* Enhanced Delete conversation button */}
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDeleteModal(true);
                  }}
                  className="px-4 py-2 text-sm bg-red hover:bg-red/90 rounded flex items-center transition-all duration-200 gap-1"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete Conversation
                </button>
              </div>

{/* Messages area */}
<div className="flex-1 overflow-y-auto mb-4 py-2">
  {Array.isArray(messages) && messages.length > 0 ? (
    messages.map((msg, index) => {
      // Determine if the message is from the selected user or current user
      const isFromSelectedUser = msg.sender._id === selectedUser._id;
      
      return (
        <div 
          key={msg._id || index} 
          className="relative my-3"
        >
          <div 
            className={`p-3 rounded-lg shadow-md relative group ${
              isFromSelectedUser 
                ? 'bg-sunk mr-auto max-w-[70%] rounded-tl-none' 
                : 'bg-teal ml-auto max-w-[70%] rounded-tr-none'
            }`}
          >
            <p className="text-ink break-words pr-6">{msg.message}</p>
            <span className="text-xs text-ink mt-1 block">
              {new Date(msg.createdAt || Date.now()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </span>
            
            {/* Message options button - positioned inside the bubble */}
            <button
              className="absolute top-2 right-2 text-ink-2 hover:text-ink p-1 rounded-full 
                        opacity-0 group-hover:opacity-100 transition-opacity duration-200
                        hover:bg-sunk"
              onClick={(e) => toggleMessageOptions(msg._id, e)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
            
            {/* Enhanced Message options menu - INSIDE the message bubble */}
            {showOptions === msg._id && (
              <div 
                className="absolute top-8 right-2 bg-raise border border-line rounded-md shadow-lg z-10 w-32 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  className="flex items-center w-full text-left px-4 py-2 hover:bg-sunk text-sm text-red hover:text-red transition-colors duration-150"
                  onClick={() => deleteMessage(msg._id)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete Message
                </button>
              </div>
            )}
          </div>
        </div>
      );
    })
  ) : (
    <div className="text-center text-ink-3 py-8 flex flex-col items-center">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
      <p>No messages yet. Start the conversation!</p>
    </div>
  )}
  <div ref={messageEndRef} />
</div>

              
              {/* Enhanced Message input */}
              <form onSubmit={sendMessage} className="mt-auto">
                <div className="flex items-center mt-2 bg-raise rounded-lg border border-line overflow-hidden shadow-lg focus-within:ring-2 focus-within:ring-teal transition-all duration-200">
                  <input 
                    ref={messageInputRef}
                    type="text" 
                    className="flex-1 p-4 bg-transparent border-0 text-ink placeholder-ink-3 focus:outline-none focus:ring-0"
                    value={newMessage} 
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="Type your message here..."
                  />
                  <button 
                    type="submit"
                    className="p-4 bg-teal text-on-accent hover:bg-teal-hi transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!newMessage.trim() || !selectedUser}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    Send
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-ink-3">
              <div className="text-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto mb-4 text-ink" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                <p className="mb-2">👈 Select an employee to start chatting</p>
                <p className="text-sm">Your messages are private and secure</p>
              </div>
            </div>
          )}
        </div>

        {/* Enhanced Delete Conversation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-ground bg-opacity-75 flex items-center justify-center z-50 backdrop-blur-sm transition-all duration-300">
            <div className="bg-raise p-6 rounded-lg max-w-md w-full border border-line shadow-xl animate-fadeIn transform transition-all scale-100">
              <div className="flex items-center mb-4 text-red">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <h3 className="text-xl font-bold">Delete Conversation</h3>
              </div>
              
              <p className="mb-6 text-ink">
                Are you sure you want to delete your conversation with 
                <span className="font-bold text-ink"> {selectedUser?.firstName} {selectedUser?.lastName}</span>? 
                <br/><br/>
                This will permanently remove all messages and cannot be undone.
              </p>
              
              <div className="flex justify-end gap-3">
                <button 
                  className="px-4 py-2 bg-sunk hover:bg-line rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-line-2"
                  onClick={() => setShowDeleteModal(false)}
                >
                  Cancel
                </button>
                <button 
                  className="px-4 py-2 bg-red hover:bg-red/90 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red flex items-center gap-2"
                  onClick={deleteConversation}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete Conversation
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
}