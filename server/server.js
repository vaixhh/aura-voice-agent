
const express = require('express')
const cors = require('cors')
const policies = require('./policies')
require('dotenv').config()

const { GoogleGenAI, Type } = require('@google/genai')

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
})

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())

// Mock order database
const orders = {
  'ORD-101': {
    orderId: 'ORD-101',
    customer: 'Priya Sharma',
    product: 'Vitamin C Serum (30ml)',
    value: 699,
    status: 'Out for Delivery',
    tracking: 'BD-982103',
    expected: '6 PM today'
  },

  'ORD-102': {
    orderId: 'ORD-102',
    customer: 'Rahul Verma',
    product: 'Hydrating Sunscreen SPF 50',
    value: 499,
    status: 'Delivered',
    tracking: 'DL-441029',
    deliveryInfo: 'Delivered 14 days ago'
  },

  'ORD-103': {
    orderId: 'ORD-103',
    customer: 'Ananya Patel',
    product: 'Green Tea Face Wash + Toner',
    value: 850,
    status: 'Processing',
    cancellationEligible: true
  }
}

// Gemini tools
const tools = [
  {
    functionDeclarations: [
      {
        name: 'get_order_details',
        description:
          'Get the real details of an Aura Skincare order. Use this when the customer asks about a specific order.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            order_id: {
              type: Type.STRING,
              description: 'Order ID, for example ORD-101'
            }
          },
          required: ['order_id']
        }
      },
      {
        name: 'check_order_cancellation',
        description:
          'Check whether an order is eligible for cancellation. Only orders with Processing status are eligible.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            order_id: {
              type: Type.STRING,
              description: 'Order ID, for example ORD-103'
            }
          },
          required: ['order_id']
        }
      }
    ]
  }
]

// Run a tool using the actual mock database
function runTool(name, args) {
  const orderId = String(args.order_id || '')
    .toUpperCase()
    .replace(/[\s-]+/g, '-')

  if (name === 'get_order_details') {
    const order = orders[orderId]

    if (!order) {
      return {
        found: false,
        message: `Order ${orderId || '(missing ID)'} was not found.`
      }
    }

    return {
      found: true,
      order
    }
  }

  if (name === 'check_order_cancellation') {
    const order = orders[orderId]

    if (!order) {
      return {
        found: false,
        message: `Order ${orderId || '(missing ID)'} was not found.`
      }
    }

    return {
      found: true,
      orderId: order.orderId,
      status: order.status,
      cancellationEligible: order.status === 'Processing',
      message:
        order.status === 'Processing'
          ? 'The order is eligible for cancellation.'
          : 'The order cannot be cancelled under the current policy.'
    }
  }

  return {
    error: 'Unknown tool.'
  }
}

// Test backend
app.get('/', (req, res) => {
  res.send('Aura Skincare backend is running!')
})

// Look up an order directly
app.get('/api/orders/:orderId', (req, res) => {
  const orderId = req.params.orderId.toUpperCase()
  const order = orders[orderId]

  if (!order) {
    return res.status(404).json({
      error: 'Order not found. Please check the order ID.'
    })
  }

  return res.json(order)
})

// Check cancellation eligibility directly
app.post('/api/orders/:orderId/cancel-check', (req, res) => {
  const orderId = req.params.orderId.toUpperCase()
  const order = orders[orderId]

  if (!order) {
    return res.status(404).json({
      error: 'Order not found.'
    })
  }

  const eligible = order.status === 'Processing'

  return res.json({
    orderId: order.orderId,
    status: order.status,
    cancellationEligible: eligible,
    message: eligible
      ? 'This order is eligible for cancellation.'
      : 'This order cannot be cancelled because it is not processing.'
  })
})

// Return store policies
app.get('/api/policies', (req, res) => {
  res.json(policies)
})

// Aria AI chat endpoint
app.post('/api/assistant/chat', async (req, res) => {
  const message = String(req.body.message || '').trim()

  if (!message) {
    return res.status(400).json({
      error: 'Please provide a message.'
    })
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({
      error: 'Gemini API key is missing. Check the server .env file.'
    })
  }

  try {
    const systemInstruction = `
You are Aria, the friendly and professional voice customer support
assistant for Aura Skincare, a premium organic Indian skincare brand.

Speak in simple, natural, concise English suitable for spoken replies.
Answer the customer's actual question and avoid unnecessary repetition.

AURA SKINCARE POLICIES:
- Free delivery applies to orders above ₹499.
- Orders of ₹499 or less have a ₹50 shipping fee.
- Standard delivery takes 3–5 business days.
- Returns are accepted within 7 days of delivery.
- Products must be unopened, unused, and in their original packaging.
- Damaged or defective products must be reported within 48 hours
  with photos. The stated resolution is a replacement.
- Orders can be cancelled only while their status is Processing.
- Shipped, Out for Delivery, and Delivered orders cannot be cancelled.
- COD is available for orders up to ₹2,500. Customers can pay by
  cash or UPI at the doorstep.

TOOL RULES:
- Use get_order_details whenever a customer asks about a specific order.
- Use check_order_cancellation when the customer asks to cancel an order
  or asks whether a specific order can be cancelled.
- Never invent order details. Use only information returned by the tool.
- If the customer mentions an invalid order ID, explain that it was not found.
- A cancellation eligibility check does NOT cancel an order.
- Never claim an order was cancelled, a refund was issued, or a replacement
  was arranged unless an actual tool confirms that action.
- If an order ID is missing, ask the customer to provide it.
- For unrelated requests, politely explain that you help with Aura
  Skincare customer support only.
- If you are uncertain, say so honestly.
`

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash-lite',
      contents: message,
      config: {
        systemInstruction,
        tools,
        temperature: 0.3
      }
    })

    const functionCalls = response.functionCalls || []

    // Gemini can answer directly without calling a tool.
    if (functionCalls.length === 0) {
      return res.json({
        reply:
          response.text ||
          'Sorry, I could not prepare a response. Please try again.'
      })
    }

    // Execute the requested tools on the backend.
    const modelContent = response.candidates?.[0]?.content

    if (!modelContent) {
      throw new Error('Gemini did not return the expected tool-call content.')
    }

    const functionResponses = functionCalls.map((call) => ({
      functionResponse: {
        name: call.name,
        response: runTool(call.name, call.args || {})
      }
    }))

    // Send tool results back to Gemini for a natural-language answer.
    const finalResponse = await ai.models.generateContent({
      model: 'gemini-3.5-flash-lite',
      contents: [
        { role: 'user', parts: [{ text: message }] },
        modelContent,
        { role: 'user', parts: functionResponses }
      ],
      config: {
        systemInstruction,
        temperature: 0.3
      }
    })

    return res.json({
      reply:
        finalResponse.text ||
        'Sorry, I could not prepare a response. Please try again.'
    })
  } catch (error) {
    console.error('Gemini assistant error:', error)

    return res.status(500).json({
      error:
        'The assistant is temporarily unavailable. Please try again.'
    })
  }
})


app.post('/api/assistant/summary', async (req, res) => {
  try {
    const { conversation } = req.body

    if (!Array.isArray(conversation) || conversation.length === 0) {
      return res.status(400).json({
        error: 'No conversation is available to summarize.'
      })
    }

    const conversationText = conversation
      .map((item) => `${item.speaker}: ${item.message}`)
      .join('\n')

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash-lite',
      contents: `Create a short call summary from this conversation:\n\n${conversationText}`,
      config: {
        systemInstruction: `
You are summarizing customer support calls for Aura Skincare.

Return only valid JSON with exactly these four fields:
- intent: a short description of what the customer wanted
- order_id: the order ID discussed, or null if none was mentioned
- resolution_status: "Resolved", "Unresolved", or "Partially Resolved"
- summary: a short, factual summary of the conversation

Use only information in the conversation.
Do not invent order details or claim an issue was resolved unless the conversation supports it.
`,
        responseMimeType: 'application/json',
        temperature: 0.2
      }
    })

    const summary = JSON.parse(response.text)

    return res.json({ summary })
  } catch (error) {
    console.error('Call summary error:', error)

    return res.status(500).json({
      error: 'Could not generate the call summary.'
    })
  }
})

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`)
})
