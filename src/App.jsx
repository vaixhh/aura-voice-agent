
import { useState } from 'react'
import './App.css'

function App() {
  // Store whether a call is active
  const [isCallActive, setIsCallActive] = useState(false)

  const [cancelCheck, setCancelCheck] = useState(null)
  const [cancelLoading, setCancelLoading] = useState(false)

  // Store the current call status
  const [status, setStatus] = useState('Idle')
  const [orderId, setOrderId] = useState('')
  const [error, setError] = useState('')
  const [transcript, setTranscript] = useState('')
  const [conversation, setConversation] = useState([])
  const [callSummary, setCallSummary] = useState(null)
  const [isListening, setIsListening] = useState(false)
  const [ariaReply, setAriaReply] = useState('')


  
const speakReply = (text) => {
  if (!('speechSynthesis' in window)) {
    setError('Text-to-speech is not supported in this browser.')
    return
  }

  window.speechSynthesis.cancel()

  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'en-IN'
  utterance.rate = 1
  utterance.pitch = 1

  utterance.onstart = () => {
  setStatus('Speaking')
}

utterance.onend = () => {
  if (isCallActive) {
    setStatus('Listening')
  }
}

window.speechSynthesis.speak(utterance)
}

  
const sendMessageToAria = async (message) => {
  if (!message.trim()) {
    setAriaReply('Please say or type a message first.')
    return
  }

  setStatus('Thinking')

try {
  const response = await fetch('http://localhost:3000/api/assistant/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: message }),
    })

    const data = await response.json()

    if (!response.ok) {
      setAriaReply(data.error || 'Something went wrong.')
      return
    }

    
setAriaReply(data.reply)

setConversation((previous) => [
  ...previous,
  { speaker: 'Aria', message: data.reply }
])

speakReply(data.reply)
  } catch (error) {
    setAriaReply('Could not connect to the server. Please check if the backend is running.')
  }
}


  // Run when Start Call is clicked
  
function startCall() {
  setConversation([])
  setTranscript('')
  setAriaReply('')
  setCallSummary(null)
  setCancelCheck(null)
  setError('')
  setIsCallActive(true)
  setStatus('Listening')
}

  // Run when End Call is clicked
  async function endCall() {
    window.speechSynthesis.cancel()
setIsListening(false)
  setIsCallActive(false)
  setStatus('Thinking')

  try {
    const response = await fetch('http://localhost:3000/api/assistant/summary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        conversation: conversation
      })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Could not generate call summary.')
    }

    setCallSummary(data.summary)
  } catch (error) {
    console.error('Call summary error:', error.message)
    setError('Could not generate the call summary. Please try again.')
  } finally {
    setStatus('Idle')
  }
}

  
  // Check whether an order can be cancelled
  async function checkCancellation() {
    const cleanOrderId = orderId.trim().toUpperCase()

    if (!cleanOrderId) {
      setError('Please enter an order ID.')
      return
    }

    setCancelLoading(true)
    setCancelCheck(null)
    setError('')

    try {
      const response = await fetch(
        `http://localhost:3000/api/orders/${encodeURIComponent(cleanOrderId)}/cancel-check`,
        { method: 'POST' }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Could not check cancellation.')
      }

      setCancelCheck(data)
    } catch (err) {
      setError(err.message || 'Unable to connect to the backend.')
    } finally {
      setCancelLoading(false)
    }
  }


  


function startListening() {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition

  if (!SpeechRecognition) {
    setError('Voice recognition is not supported in this browser.')
    return
  }

  const recognition = new SpeechRecognition()

  recognition.lang = 'en-IN'
  recognition.continuous = true
  recognition.interimResults = true

  let latestTranscript = ''
  let silenceTimer = null
  let hasSentMessage = false

  recognition.onstart = () => {
    setIsListening(true)
    setStatus('Listening')
    setError('')
  }

  recognition.onresult = (event) => {
    let combinedText = ''

    for (let i = 0; i < event.results.length; i++) {
      combinedText += event.results[i][0].transcript + ' '
    }

    latestTranscript = combinedText.trim()

    // Wait until the user pauses before sending the question.
    if (silenceTimer) {
      clearTimeout(silenceTimer)
    }

    silenceTimer = setTimeout(() => {
      if (hasSentMessage || !latestTranscript) return

      hasSentMessage = true
      const spokenText = latestTranscript

      recognition.stop()
      setIsListening(false)
      setTranscript(spokenText)

      setConversation((previous) => [
        ...previous,
        { speaker: 'Customer', message: spokenText }
      ])

      sendMessageToAria(spokenText)
    }, 2500)
  }

  recognition.onerror = () => {
    if (silenceTimer) clearTimeout(silenceTimer)
    setIsListening(false)
    setError('Could not recognize your voice. Please try again.')
  }

  recognition.onend = () => {
    setIsListening(false)

    if (silenceTimer) {
      clearTimeout(silenceTimer)
      silenceTimer = null
    }
  }

  recognition.start()
}


  return (
    <div className="app">
      <header className="header">
        <h1>Aura Skincare</h1>
        <p>AI Customer Support</p>
      </header>

      <main className="main">
        <section className="agent-card">
          <div className="avatar">A</div>

          <h2>Hi, I'm Aria!</h2>

          <p>
            Your personal customer support assistant.
            How can I help you today?
          </p>

          <div className="status">
            Status: {status}
          </div>

          <div className="buttons">
            <button
              className="start-btn"
              onClick={startCall}
              disabled={isCallActive}
            >
              Start Call
            </button>

            <button
              className="end-btn"
              onClick={endCall}
              disabled={!isCallActive}
            >
              End Call
            </button>
            
           <button
                className="start-btn"
                onClick={() => {
                  startListening()
                }}
                disabled={isListening}
              >
                {isListening ? 'Listening...' : 'Speak'}
            </button>

          </div>

          <p className="note">
            {isCallActive
              ? 'Call started. Voice will be added later.'
              : 'Click Start Call to begin a session.'}
          </p>
        </section>

        <section className="orders">
          <h2>Test Orders</h2>

          <div className="order-card">
            <h3>ORD-101</h3>
            <p>Product: Vitamin C Serum</p>
            <p>Status: Out for Delivery</p>
            <p>Expected: 6 PM today</p>
          </div>

          <div className="order-card">
            <h3>ORD-102</h3>
            <p>Product: Hydrating Sunscreen SPF 50</p>
            <p>Status: Delivered</p>
            <p>Delivered 14 days ago</p>
          </div>

          <div className="order-card">
            <h3>ORD-103</h3>
            <p>Product: Green Tea Face Wash + Toner</p>
            <p>Status: Processing</p>
            <p>Eligible for cancellation</p>
          </div>
        </section>

        
        <section className="cancellation">
          <h2>Check Order Cancellation</h2>

          <input
            type="text"
            placeholder="Enter order ID (e.g. ORD-103)"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
          />

          <button
            onClick={checkCancellation}
            disabled={cancelLoading}
          >
            {cancelLoading ? 'Checking...' : 'Check Cancellation'}
          </button>

          {error && <p className="error">{error}</p>}

          {cancelCheck && (
            <div className="cancel-result">
              <p>Order: {cancelCheck.orderId}</p>
              <p>Status: {cancelCheck.status}</p>
              <p>
                {cancelCheck.message}
              </p>  
            </div>
          )}
        </section>


        
       <section className="transcript">
        <h2>Call Transcript</h2>

        {conversation.length > 0 ? (
          conversation.map((item, index) => (
            <p key={index}>
              <strong>{item.speaker}:</strong> {item.message}
            </p>
          ))
        ) : (
          <p>Your conversation will appear here.</p>
        )}
      </section>


      
{callSummary && (
  <section className="transcript">
    <h2>Call Summary (JSON)</h2>
    <pre>
      {JSON.stringify(callSummary, null, 2)}
    </pre>
  </section>
)}



        
        {ariaReply && (
          <div className="aria-reply">
            <strong>Aria:</strong>
            <p>{ariaReply}</p>
          </div>
        )}


      </main>
    </div>
  )
}

export default App
