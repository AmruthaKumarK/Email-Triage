import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useResetEnvironment, 
  useStepEnvironment, 
  useGetEnvironmentState,
  getGetEnvironmentStateQueryKey
} from "@workspace/api-client-react";
import type { Action } from "@workspace/api-client-react/src/generated/api.schemas";
import { useToast } from "@/components/ui/use-toast";

export function useLiveSession() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<string>("task_classify");
  const [agentName, setAgentName] = useState<string>("HumanBaseline");
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const resetMutation = useResetEnvironment();
  const stepMutation = useStepEnvironment();

  const { data: envState, isLoading: isLoadingState } = useGetEnvironmentState(
    { session_id: sessionId! },
    {
      query: {
        enabled: !!sessionId,
        refetchInterval: (query) => {
          // Poll every 5s if session is active and not done, otherwise don't poll
          return query.state.data?.done ? false : 5000;
        }
      }
    }
  );

  const startSession = useCallback(async () => {
    try {
      const res = await resetMutation.mutateAsync({
        data: {
          task_id: activeTaskId,
          agent_name: agentName,
          seed: Math.floor(Math.random() * 10000)
        }
      });
      setSessionId(res.session_id);
      setSelectedEmailId(null);
      toast({
        title: "Environment Started",
        description: `Initialized ${activeTaskId} episode.`,
      });
    } catch (err: any) {
      toast({
        title: "Failed to start environment",
        description: err.message || "An unknown error occurred.",
        variant: "destructive"
      });
    }
  }, [activeTaskId, agentName, resetMutation, toast]);

  const takeAction = useCallback(async (action: Action) => {
    if (!sessionId) return;
    try {
      const res = await stepMutation.mutateAsync({
        data: {
          session_id: sessionId,
          action
        }
      });
      
      // Update cache with new state
      queryClient.invalidateQueries({
        queryKey: getGetEnvironmentStateQueryKey({ session_id: sessionId })
      });

      if (res.done) {
        toast({
          title: "Episode Complete!",
          description: `Final Score: ${(res.info?.cumulative_score || 0).toFixed(2)}`,
        });
      } else {
        toast({
          title: "Action Recorded",
          description: `Reward: +${res.reward.toFixed(2)}. ${res.info?.action_feedback || ''}`,
        });
      }
    } catch (err: any) {
      toast({
        title: "Action Failed",
        description: err.message || "Invalid action.",
        variant: "destructive"
      });
    }
  }, [sessionId, stepMutation, queryClient, toast]);

  return {
    sessionId,
    activeTaskId,
    setActiveTaskId,
    agentName,
    setAgentName,
    selectedEmailId,
    setSelectedEmailId,
    envState,
    isLoadingState,
    isResetting: resetMutation.isPending,
    isStepping: stepMutation.isPending,
    startSession,
    takeAction
  };
}
