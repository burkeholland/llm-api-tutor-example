"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = __importStar(require("vscode"));
// Use gpt-4o since it is fast and high quality. gpt-3.5-turbo and gpt-4 are also available.
const MODEL_SELECTOR = { vendor: 'copilot', family: 'gpt-4o' };
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
function activate(context) {
    context.subscriptions.push(vscode.commands.registerTextEditorCommand("llm-api-tutor-example.annotate", async (textEditor) => {
        const selection = textEditor.selection;
        let chatResponse;
        try {
            const [model] = await vscode.lm.selectChatModels(MODEL_SELECTOR);
            if (!model) {
                console.log("No model found.");
                return;
            }
            const messages = [
                vscode.LanguageModelChatMessage.User(`You are a code tutor who helps students learn how to write better code. Your job is to evaluate a block of code that the user gives you. You will then annotate any lines that could be improved with a brief suggestion. The "line" key should be the line number of the code that you are annotating, and the "message" key should be your suggestion. For example, if you wanted to suggest that the user change line 3 to use a for loop instead of a while loop, you would write: [{"line": 3, "message": "Consider using a for loop instead of a while loop."}]. If you have no suggestions, you can return an empty array. You will format your response as a simple text message where the line number is followed by a colon and then your suggestion. For example, "3: Consider using a for loop instead of a while loop. Separate each suggestion with a new line."`),
                vscode.LanguageModelChatMessage.User(`Here is the code I would like you to evaluate: ${textEditor.document.getText(selection)}`),
            ];
            chatResponse = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);
        }
        catch (err) {
            if (err instanceof vscode.LanguageModelError) {
                console.log(err.message, err.code, err.cause);
            }
            else {
                throw err;
            }
            return;
        }
        try {
            for await (const fragment of chatResponse.text) {
                // parse out the line number and message from the fragment.
                const [line, message] = fragment.split(": ");
                const lineNumber = parseInt(line);
                const decorationType = vscode.window.createTextEditorDecorationType({
                    after: {
                        contentText: message,
                        color: 'rgba(255, 0, 0, 0.5)'
                    }
                });
                const decorations = [];
                for (let i = selection.start.line; i <= selection.end.line; i++) {
                    const line = textEditor.document.lineAt(i);
                    decorations.push({
                        range: new vscode.Range(i, line.range.start.character, i, line.range.end.character)
                    });
                }
                textEditor.setDecorations(decorationType, decorations);
            }
        }
        catch (err) {
            console.log(err);
        }
    }));
}
exports.activate = activate;
// This method is called when your extension is deactivated
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map