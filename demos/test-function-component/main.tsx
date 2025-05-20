import { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';

// function App(props: { title: string }) {
//   console.log("App", props.title)
//   const [count, setCount] = useState(100)
//   const arr =
// 		count % 2 === 0
// 			? [
// 					<li key="1">1</li>,
// 					<li key="2">2</li>,
// 					<li key="3">3</li>
// 				]
// 			: [
// 					<li key="3">3</li>,
// 					<li key="2">2</li>,
// 					<li key="1">1</li>
// 				];
// 	return (
// 		<ul
// 			onClick={() => {
// 				setCount((count) => count + 1);
// 				setCount((count) => count + 1);
// 				setCount((count) => count + 1);
// 				setCount((count) => count + 1);
// 			}}
// 		>
// 			{count}
// 		</ul>
// 	);
// }

// console.log("App", App.toString(), <App title="Hello World" />)

function App() {
	const [num, updateNum] = useState(0);

	useEffect(() => {
		console.log('App mount');
	}, []);

	useEffect(() => {
		console.log('num change create', num);
		return () => {
			console.log('num change destroy', num);
		};
	}, [num]);

	return (
		<div onClick={() => updateNum(num + 1)}>
			{num === 0 ? <Child /> : 'noop'}
		</div>
	);
}

function Child() {
	useEffect(() => {
		console.log('Child mount');
		return () => {
			console.log('Child unmount');
		};
	}, []);

	return 'i am child';
}

const root = ReactDOM.createRoot(
	document.getElementById('root')!
);
root.render(<App />);
console.log('root', root);
