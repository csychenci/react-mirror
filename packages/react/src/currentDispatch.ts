import { Action } from 'shared/ReactType';

export interface Dispatcher {
	useState: <T>(
		initialState: (() => T) | T
	) => [T, Dispatch<T>];
}

export type Dispatch<State> = (
	action: Action<State>
) => void;

const currentDispatcher: {
	current: Dispatcher | null;
} = {
	current: null
};

export const resolveDispatcher =
	(): Dispatcher => {
		const dispatcher = currentDispatcher.current;
		if (!dispatcher) {
			throw new Error(
				'hooks 只能在函数式组件中执行'
			);
		}
		return dispatcher;
	};

export default currentDispatcher;
