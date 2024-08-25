// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// Use gpt-4o since it is fast and high quality. gpt-3.5-turbo and gpt-4 are also available.
const MODEL_SELECTOR: vscode.LanguageModelChatSelector = { vendor: 'copilot', family: 'gpt-4o' };

const ANNOTATION_PROMPT = `
You are a code tutor who helps students learn how to write better code.Your job is to evaluate a block of code that the user gives you.The user is writing You will then annotate any lines that could be improved with a brief suggestion and the reason why you are making that suggestion.Only make suggestions when you feel the severity is enough that it will impact the readibility and maintainability of the code.Be friendly with your suggestions and remember that these are students so they need gentle guidance.Format each suggestion as a single JSON object.It is not necessary to wrap your response in triple backticks.Here is an example of what your response should look like:

{ "line": 1, "suggestion": "I think you should use a for loop instead of a while loop. A for loop is more concise and easier to read." } { "line": 12, "suggestion": "I think you should use a for loop instead of a while loop. A for loop is more concise and easier to read." }
`;

let decorations: vscode.TextEditorDecorationType[] = [];

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.commands.registerTextEditorCommand("llm-api-tutor-example.annotate", async (textEditor: vscode.TextEditor) => {

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
					vscode.LanguageModelChatMessage.User(ANNOTATION_PROMPT),
					vscode.LanguageModelChatMessage.User(`The user is coding in ${textEditor.document.languageId}.`),
					vscode.LanguageModelChatMessage.User(`Here is the code I would like you to evaluate: ${codeWithLineNumbers}`),
				];

				chatResponse = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);

				let accumulatedResponse = "";
				for await (const fragment of chatResponse.text) {

					// the accumulator holds the response until we get a complete line
					accumulatedResponse += fragment;

					// if the fragment is a }, we're at the end of a JSON object
					if (fragment.includes("}")) {
						try {
							const annotation = JSON.parse(accumulatedResponse);
							applyDecoration(textEditor, annotation.line, annotation.suggestion);
							// reset the accumulator for the next line
							accumulatedResponse = "";
						}
						catch (e) {
							// do nothing
						}
					}
				}
			} catch (err) {
				if (err instanceof vscode.LanguageModelError) {
					console.log(err.message, err.code, err.cause);
				} else {
					throw err;
				}
				return;
			}
		})
	);

	context.subscriptions.push(vscode.commands.registerTextEditorCommand("llm-api-tutor-example.clear", async (textEditor: vscode.TextEditor) => {
		removeAllDecorations();
	}));
}

function getCodeWithLineNumbers(textEditor: vscode.TextEditor) {
	let currentLine = textEditor.visibleRanges[0].start.line;
	const endLine = textEditor.visibleRanges[0].end.line;
	let code = '';
	while (currentLine < endLine) {
		code += `${currentLine + 1}: ${textEditor.document.lineAt(currentLine).text} \n`;
		currentLine++;
	}
	return code;
}

function applyDecoration(editor: vscode.TextEditor, line: number, suggestion: string) {

	const decorationType = vscode.window.createTextEditorDecorationType({
		after: {
			contentText: ` ${suggestion.substring(0, 25) + "..."}`,
			color: "grey",
		},
	});

	// get the end of the line with the specified line number
	const lineLength = editor.document.lineAt(line - 1).text.length;
	const range = new vscode.Range(
		new vscode.Position(line - 1, lineLength),
		new vscode.Position(line - 1, lineLength),
	);

	const decoration = { range: range, hoverMessage: suggestion };

	vscode.window.activeTextEditor?.setDecorations(decorationType, [
		decoration,
	]);

	// keep track of the decorations so we can remove them later
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
