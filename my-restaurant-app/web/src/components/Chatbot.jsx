// import React, { useState } from 'react';
// import { getGenerativeModel } from 'firebase/vertexai-web';
// import { app } from '../firebase';

// const model = getGenerativeModel(app, { model: 'gemini-pro' });

// function Chatbot() {
//   const [messages, setMessages] = useState([]);
//   const [input, setInput] = useState('');
//   const [loading, setLoading] = useState(false);

//   const sendMessage = async () => {
//     if (!input) return;
//     setLoading(true);
//     setMessages([...messages, { text: input, sender: 'user' }]);
//     try {
//       const result = await model.generateContent(input);
//       const responseText = result.response.text();
//       setMessages(prevMessages => [...prevMessages, { text: responseText, sender: 'bot' }]);
//     } catch (error) {
//       console.error("เกิดข้อผิดพลาดในการเรียกใช้ Gemini API:", error);
//       setMessages(prevMessages => [...prevMessages, { text: "เกิดข้อผิดพลาดในการประมวลผล", sender: 'bot' }]);
//     } finally {
//       setLoading(false);
//       setInput('');
//     }
//   };

//   return (
    
      
//         {messages.map((message, index) => (
          
//             {message.text}
          
//         ))}
//         // {loading &&  กำลังประมวลผล... }
      
      
//         <input
//           type="text"
//           value={input}
//           onChange={(e) => setInput(e.target.value)}
//           placeholder="พิมพ์ข้อความ..."
//         />
//         <button onClick={sendMessage} disabled={loading}>ส่ง</button>
      
    
//   );
// }

// export default Chatbot;
