// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// Use gpt-4o since it is fast and high quality. gpt-3.5-turbo and gpt-4 are also available.
const MODEL_SELECTOR: vscode.LanguageModelChatSelector = { vendor: 'copilot', family: 'gpt-4o' };

let decorations: vscode.TextEditorDecorationType[] = [];

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.commands.registerTextEditorCommand("llm-api-tutor-example.annotate", async (textEditor: vscode.TextEditor) => {

			// clear out all text decorations in the current editor
			textEditor.setDecorations(vscode.window.createTextEditorDecorationType({}), []);

			let chatResponse: vscode.LanguageModelChatResponse | undefined;

			try {
				const [model] = await vscode.lm.selectChatModels(MODEL_SELECTOR);

				if (!model) {
					console.log("No model found.");
					return;
				}

				// remove all existing decorations
				removeAllDecorations();

				const codeWithLineNumbers = await getCodeWithLineNumbers(textEditor);

				const messages = [
					vscode.LanguageModelChatMessage.User(`You are a code tutor who helps students learn how to write better code. Your job is to evaluate a block of code that the user gives you. The user is writing ${textEditor.document.languageId}. You will then annotate any lines that could be improved with a brief suggestion. Only make suggestions when you feel the severity is enough that it will impact the readibility and maintainability of the code. Each suggestion should end with a new line. If several lines need the same suggestion, you can combine those into a single suggestion by listing out the line numbers in your suggestion. Format your response so that you indicate a new suggestion with @ followed by the line number the suggestion applies to followed by a space followed by a message. Here is an example response: '@3 Imports should appear at the top of the file.' Sometimes you will have no suggestions in which case you can just return '@0 No suggestions.'`),
					vscode.LanguageModelChatMessage.User(`Here is the code I would like you to evaluate: ${codeWithLineNumbers}`),
				];

				chatResponse = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);
			} catch (err) {
				if (err instanceof vscode.LanguageModelError) {
					console.log(err.message, err.code, err.cause);
				} else {
					throw err;
				}
				return;
			}

			try {
				if (chatResponse) {
					await processChatResponseFragments(chatResponse, textEditor);
				}
			}
			catch (err) {
				console.log(err);
			}
		})
	);

	context.subscriptions.push(vscode.commands.registerTextEditorCommand("llm-api-tutor-example.clear", async (textEditor: vscode.TextEditor) => {
		removeAllDecorations();
	}));
}

async function processChatResponseFragments(chatResponse: vscode.LanguageModelChatResponse, textEditor: vscode.TextEditor) {
	let isNewLine: boolean = false;
	let annotationLineNumber = 0;
	let annotation: string = "";

	let accumulatedResponse = "";

	for await (const fragment of chatResponse.text) {
		accumulatedResponse += fragment;

		// Check if the accumulated response contains a complete suggestion
		const suggestions = accumulatedResponse.split("\n");
		for (let i = 0; i < suggestions.length - 1; i++) {
			const suggestion = suggestions[i];
			if (suggestion.startsWith('@')) {
				const [lineNumber, ...messageParts] = suggestion.slice(1).split(' ');
				const message = messageParts.join(' ');
				const line = parseInt(lineNumber, 10);

				if (line > 0) {
					// Apply decoration to the editor
					applyDecoration(textEditor, line, message);
				}
			}
		}

		// Keep the last incomplete suggestion in the accumulator
		accumulatedResponse = suggestions[suggestions.length - 1];
	}
}

async function getCodeWithLineNumbers(textEditor: vscode.TextEditor): Promise<string> {
	let selectedText = "";
	let startLineNumber = 0;
	let endLineNumber = 0;

	const fullRange = new vscode.Range(
		textEditor.visibleRanges[0].start,
		textEditor.visibleRanges[0].end
	);

	selectedText = textEditor.document.getText(fullRange);
	startLineNumber = textEditor.visibleRanges[0].start.line + 1;
	endLineNumber = textEditor.visibleRanges[0].end.line + 1;

	const lines = selectedText.split("\n");
	const linesWithNumbers = lines.map((line, index) => `${startLineNumber + index}: ${line}`);

	const numberedCode = linesWithNumbers.join("\n");

	return numberedCode;
}

function applyDecoration(editor: vscode.TextEditor, line: number, message: string) {
	const decorationType = vscode.window.createTextEditorDecorationType({
		after: {
			contentText: ` ${message}`, // Add a space before the message
			color: "grey",
		},
	});

	const lineLength = editor.document.lineAt(line - 1).text.length;
	const range = new vscode.Range(new vscode.Position(line - 1, lineLength), new vscode.Position(line - 1, lineLength));
	editor.setDecorations(decorationType, [range]);

	// store the decoration so we can clear it later
	decorations.push(decorationType);
}

function removeAllDecorations() {
	for (const decoration of decorations) {
		decoration.dispose();
	}
	decorations = [];
}

// This method is called when your extension is deactivated
export function deactivate() { }
