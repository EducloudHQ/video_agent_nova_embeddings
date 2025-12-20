import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { Amplify } from 'aws-amplify'
// @ts-ignore
import awsExports from './aws-exports'

console.log('Configuring Amplify', awsExports)
Amplify.configure(awsExports)
console.log('Amplify Configured', Amplify.getConfig())

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
