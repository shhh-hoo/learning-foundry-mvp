import {
  AssistantRuntimeProvider,
  useExternalStoreRuntime
} from "@assistant-ui/react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { sendLearnerTurn } from "../api.js";

function toThreadMessage(event) {
  return {
    id: event.id,
    role: event.role === "LEARNER" ? "user" : "assistant",
    content: event.content,
    createdAt: event.createdAt ? new Date(event.createdAt) : new Date()
  };
}

export function FoundryChatProvider({ studentId, taskId, conversationEvents, children }) {
  const queryClient = useQueryClient();
  const canonicalMessages = useMemo(
    () => conversationEvents.map(toThreadMessage),
    [conversationEvents]
  );
  const [messages, setMessages] = useState(canonicalMessages);

  useEffect(() => {
    setMessages(canonicalMessages);
  }, [canonicalMessages]);

  const refreshProductState = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["student", studentId] }),
      queryClient.invalidateQueries({ queryKey: ["state"] })
    ]);
  }, [queryClient, studentId]);

  const onNew = useCallback(async (message) => {
    const textPart = message.content.find((part) => part.type === "text");
    const text = textPart?.text?.trim();
    if (!text) return;

    const optimisticUser = {
      id: `optimistic-${crypto.randomUUID()}`,
      role: "user",
      content: text,
      createdAt: new Date(),
      metadata: { isOptimistic: true }
    };
    setMessages((current) => [...current, optimisticUser]);

    try {
      const result = await sendLearnerTurn({
        studentId,
        taskId,
        message: text,
        trigger: "CHAT_MESSAGE"
      });

      if (result.assistantEvent) {
        setMessages((current) => [
          ...current.filter((item) => item.id !== optimisticUser.id),
          { ...optimisticUser, metadata: undefined },
          toThreadMessage(result.assistantEvent)
        ]);
      }
      await refreshProductState();
    } catch (error) {
      setMessages((current) => current.filter((item) => item.id !== optimisticUser.id));
      throw error;
    }
  }, [refreshProductState, studentId, taskId]);

  const runtime = useExternalStoreRuntime({
    messages,
    setMessages,
    onNew,
    convertMessage: (message) => message
  });

  return <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>;
}
