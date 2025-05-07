import { useState } from "react"
import ReactDOM from 'react-dom/client'


function App(props: { title: string }) {
  console.log("App", props.title)
  const [count, setCount] = useState(100)
  const arr =
		count % 2 === 0
			? [
					<li key="1">1</li>,
					<li key="2">2</li>,
					<li key="3">3</li>
				]
			: [
					<li key="3">3</li>,
					<li key="2">2</li>,
					<li key="1">1</li>
				];
	return (
		<ul
			onClick={() => {
				setCount((count) => count + 1);
				setCount((count) => count + 1);
				setCount((count) => count + 1);
				setCount((count) => count + 1);
			}}
		>
			{count}
		</ul>
	);
}

console.log("App", App.toString(), <App title="Hello World" />)

const root = ReactDOM.createRoot(document.getElementById('root')!)
root.render(<App title="Hello World" />)
console.log("root", root)
