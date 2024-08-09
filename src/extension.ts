// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// Use gpt-4o since it is fast and high quality. gpt-3.5-turbo and gpt-4 are also available.
const MODEL_SELECTOR: vscode.LanguageModelChatSelector = { vendor: 'copilot', family: 'gpt-4o' };

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.commands.registerTextEditorCommand("llm-api-tutor-example.annotate", async (textEditor: vscode.TextEditor) => {

			// clear out all text decorations in the current editor
			textEditor.setDecorations(vscode.window.createTextEditorDecorationType({}), []);

			const selection = textEditor.selection;
			let chatResponse: vscode.LanguageModelChatResponse | undefined;

			try {

				const [model] = await vscode.lm.selectChatModels(MODEL_SELECTOR);

				if (!model) {
					console.log("No model found.");
					return;
				}

				let selectedText = "";
				let startLineNumber = 0;
				let endLineNumber = 0;

				// if there is no selection, select all the text in the viewable editor space
				if (!selectedText) {
					const fullRange = new vscode.Range(
						textEditor.visibleRanges[0].start,
						textEditor.visibleRanges[0].end
					);
					selectedText = textEditor.document.getText(fullRange);
					startLineNumber = textEditor.visibleRanges[0].start.line + 1;
					endLineNumber = textEditor.visibleRanges[0].end.line + 1;
				}
				else {
					selectedText = textEditor.document.getText(selection);
					startLineNumber = selection.start.line + 1;
					endLineNumber = selection.end.line + 1;
				}

				const lines = selectedText.split("\n");
				const linesWithNumbers = lines.map((line, index) => `${startLineNumber + index}: ${line}`);

				const numberedCode = linesWithNumbers.join("\n");

				const messages = [
					vscode.LanguageModelChatMessage.User(`You are a code tutor who helps students learn how to write better code. Your job is to evaluate a block of code that the user gives you. You will then annotate any lines that could be improved with a brief suggestion. Each suggestion should end with a new line. If several lines need the same suggestion, you can combine those into a single suggestion by listing out the line numbers in your suggestion. Format your response so that you indicate a new suggestion with @ followed by the line number the suggestion applies to followed by a space followed by a message. Here is an example response: '@3 Imports should appear at the top of the file.'`),
					vscode.LanguageModelChatMessage.User(`Here is the code I would like you to evaluate: ${numberedCode}`),
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
				let isNewLine: boolean = false;
				let annotationLineNumber = 0;
				let annotation: string = "";

				for await (const fragment of chatResponse.text) {
					// if the fragment is an @, this indicates a new line.
					if (fragment === "@") {

						// write the previous annotation as a message with a decoration at the end of the line
						if (annotationLineNumber > 0) {
							const lineLength = textEditor.document.lineAt(annotationLineNumber - 1).text.length;
							const range = new vscode.Range(annotationLineNumber - 1, lineLength, annotationLineNumber - 1, lineLength);

							// if the annotation is too long to fit on the line, truncate it and add the full message in a tooltip
							const maxLength = 25;
							const truncatedAnnotation = annotation.length > maxLength ? annotation.substring(0, maxLength) + "..." : annotation;

							const decoration = {
								range,
								renderOptions: {
									after: {
										contentText: ` ${truncatedAnnotation}`,
										color: "green"
									}
								},
								hoverMessage: annotation
							};
							textEditor.setDecorations(vscode.window.createTextEditorDecorationType({}), [decoration]);
						}

						isNewLine = true;
						annotation = "";
						continue;
					}

					// if the previous fragment was an @, this fragment is a line number.
					if (isNewLine) {
						isNewLine = false;

						annotationLineNumber = parseInt(fragment);
						continue;
					}

					// otherwise, this fragment is part of the message for the line
					annotation += fragment;
				}
			}
			catch (err) {
				console.log(err);
			}
		})
	);
}

// This method is called when your extension is deactivated
export function deactivate() { }
