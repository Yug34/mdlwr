"use client";
 
import { useChat } from "@ai-sdk/react";
import { useState } from "react";
 
import {
	Conversation,
	ConversationContent,
	ConversationEmptyState,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
	PromptInput,
	PromptInputTextarea,
	PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
 
export default function Chat() {
	const [input, setInput] = useState("");
	const { messages, sendMessage, status } = useChat();
 
	const isLoading = status === "streaming" || status === "submitted";
 
	return (
		<div className="flex flex-col h-screen">
			<Conversation>
				<ConversationContent>
					{messages.length === 0 ? (
						<ConversationEmptyState
							title="Start a conversation"
							description="Type a message below to begin"
						/>
					) : (
						messages.map((message) => (
							<Message key={message.id} from={message.role}>
								<MessageContent>
									{message.role === "assistant" ? (
										<MessageResponse>
											{message.parts
												?.filter((part) => part.type === "text")
												.map((part) => part.text)
												.join("")}
										</MessageResponse>
									) : (
										message.parts?.map(
											(part) => part.type === "text" && part.text,
										)
									)}
								</MessageContent>
							</Message>
						))
					)}
				</ConversationContent>
			</Conversation>
 
			<div className="border-t p-4">
				<PromptInput
					onSubmit={(message, event) => {
						event.preventDefault();
						if (message.text) {
							sendMessage({ text: message.text });
							setInput("");
						}
					}}
					className="max-w-3xl mx-auto flex gap-2 items-end"
				>
					<PromptInputTextarea
						value={input}
						onChange={(e) => setInput(e.target.value)}
						placeholder="Type your message..."
						disabled={isLoading}
						rows={1}
						className="flex-1"
					/>
					<PromptInputSubmit disabled={isLoading} />
				</PromptInput>
			</div>
		</div>
	);
}