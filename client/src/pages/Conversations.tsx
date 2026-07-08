import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageCircle, Plus, Send, Trash2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Conversations() {
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
  const [newConversationTitle, setNewConversationTitle] = useState("");
  const [selectedAgentIds, setSelectedAgentIds] = useState<number[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);

  // Queries
  const conversationsQuery = trpc.conversations.list.useQuery();
  const agentsQuery = trpc.agents.list.useQuery();
  const messagesQuery = trpc.conversations.getMessages.useQuery(
    { conversationId: selectedConversationId! },
    { enabled: !!selectedConversationId }
  );

  // Mutations
  const createConversationMutation = trpc.conversations.create.useMutation({
    onSuccess: (data: any) => {
      toast.success("Conversation created");
      setNewConversationTitle("");
      setSelectedAgentIds([]);
      setIsCreatingConversation(false);
      conversationsQuery.refetch();
      setSelectedConversationId(data?.id);
    },
    onError: () => {
      toast.error("Failed to create conversation");
    },
  });

  const sendMessageMutation = trpc.conversations.agentResponse.useMutation({
    onSuccess: () => {
      setMessageInput("");
      messagesQuery.refetch();
    },
    onError: () => {
      toast.error("Failed to send message");
    },
  });

  const handleCreateConversation = () => {
    if (!newConversationTitle.trim()) {
      toast.error("Please enter a conversation title");
      return;
    }
    createConversationMutation.mutate({
      title: newConversationTitle,
    });
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedConversationId) return;

    if (selectedAgentIds.length === 0) {
      toast.error("Please select at least one agent");
      return;
    }

    sendMessageMutation.mutate({
      conversationId: selectedConversationId,
      agentIds: selectedAgentIds,
      userMessage: messageInput,
    });
  };

  const selectedConversation = (conversationsQuery.data as any[])?.find(
    (c: any) => c.id === selectedConversationId
  ) || null;

  if (!selectedConversationId) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Conversations</h1>
            <p className="text-muted-foreground mt-1">
              Chat with your agents and explore their reasoning
            </p>
          </div>
          <Dialog open={isCreatingConversation} onOpenChange={setIsCreatingConversation}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                New Conversation
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Start a New Conversation</DialogTitle>
                <DialogDescription>
                  Create a new conversation to chat with your agents
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Conversation Title</label>
                  <Input
                    placeholder="e.g., Market Research Discussion"
                    value={newConversationTitle}
                    onChange={(e) => setNewConversationTitle(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <Button
                  onClick={handleCreateConversation}
                  disabled={createConversationMutation.isPending}
                  className="w-full"
                >
                  {createConversationMutation.isPending ? "Creating..." : "Create Conversation"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {conversationsQuery.isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : conversationsQuery.data && (conversationsQuery.data as any[]).length > 0 ? (
          <div className="grid gap-3">
            {(conversationsQuery.data as any[]).map((conversation: any) => (
              <Card
                key={conversation.id}
                className="p-4 cursor-pointer hover:bg-accent transition-colors"
                onClick={() => setSelectedConversationId(conversation.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold flex items-center gap-2">
                      <MessageCircle className="w-4 h-4" />
                      {conversation.title}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {new Date(conversation.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant="outline">Chat</Badge>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <MessageCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">No conversations yet</p>
            <Button onClick={() => setIsCreatingConversation(true)}>
              Start Your First Conversation
            </Button>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setSelectedConversationId(null)}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{selectedConversation?.title}</h1>
          <p className="text-sm text-muted-foreground">
            {new Date(selectedConversation?.createdAt || "").toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Agent Selection */}
      <Card className="p-4">
        <label className="text-sm font-medium">Select Agents to Chat With</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {agentsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading agents...</p>
          ) : agentsQuery.data && agentsQuery.data.length > 0 ? (
            agentsQuery.data.map((agent: any) => (
              <Badge
                key={agent.id}
                variant={selectedAgentIds.includes(agent.id) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => {
                  setSelectedAgentIds((prev) =>
                    prev.includes(agent.id)
                      ? prev.filter((id) => id !== agent.id)
                      : [...prev, agent.id]
                  );
                }}
              >
                {agent.name}
              </Badge>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No agents available</p>
          )}
        </div>
      </Card>

      {/* Messages */}
      <Card className="p-4 min-h-[400px] max-h-[500px] overflow-y-auto bg-muted/30">
        {messagesQuery.isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : messagesQuery.data && messagesQuery.data.length > 0 ? (
          <div className="space-y-4">
            {messagesQuery.data.map((message: any, index: number) => (
              <div
                key={index}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-xs lg:max-w-md rounded-lg p-3 ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background border border-border"
                  }`}
                >
                  {message.role !== "user" && (
                    <p className="text-xs font-semibold mb-1 opacity-75">Agent Response</p>
                  )}
                  <div className="text-sm">
                    <Streamdown>{message.content}</Streamdown>
                  </div>
                  <p className="text-xs opacity-60 mt-1">
                    {new Date(message.createdAt).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">No messages yet. Start the conversation!</p>
          </div>
        )}
      </Card>

      {/* Message Input */}
      <div className="flex gap-2">
        <Input
          placeholder="Ask your agents a question..."
          value={messageInput}
          onChange={(e) => setMessageInput(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage();
            }
          }}
          disabled={sendMessageMutation.isPending || selectedAgentIds.length === 0}
        />
        <Button
          onClick={handleSendMessage}
          disabled={
            sendMessageMutation.isPending ||
            !messageInput.trim() ||
            selectedAgentIds.length === 0
          }
          className="gap-2"
        >
          <Send className="w-4 h-4" />
          Send
        </Button>
      </div>

      {selectedAgentIds.length === 0 && (
        <p className="text-sm text-yellow-600 dark:text-yellow-500">
          ⚠️ Please select at least one agent to send messages
        </p>
      )}
    </div>
  );
}
