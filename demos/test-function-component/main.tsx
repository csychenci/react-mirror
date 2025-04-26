import { useState } from "react"
import ReactDOM from 'react-dom/client'


function App(props: { title: string }) {
  console.log("App", props.title)
  const [count, setCount] = useState(100)
  window.setCount = setCount
  return <div>{count > 10 ? "aaa" : count}</div>
}

console.log("App", App.toString(), <App title="Hello World" />)

const root = ReactDOM.createRoot(document.getElementById('root')!)
root.render(<App title="Hello World" />)
console.log("root", root)
