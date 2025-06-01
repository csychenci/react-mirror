import { ReactContext } from 'shared/ReactType';

let prevContextValue: any = null;
const prevContextStack: ReactContext<any>[] = [];

export function pushProvider<T>(
	context: ReactContext<T>,
	newValue: T
) {
	prevContextStack.push(prevContextValue);
	prevContextValue = context._currentValue;
	context._currentValue = newValue;
	console.log(
		'pushProvider',
		prevContextValue,
		context,
		prevContextStack
	);
}

export function popProvider<T>(
	context: ReactContext<T>
) {
	console.log(
		'popProvider',
		context,
		prevContextValue,
		prevContextStack
	);
	context._currentValue = prevContextValue;
	prevContextValue = prevContextStack.pop();
}
