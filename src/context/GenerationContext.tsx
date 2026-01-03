
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

type GenerationType = 'poster' | 'infographic' | 'video';

interface GenerationTask {
    id: string;
    type: GenerationType;
    prompt: string;
    status: 'pending' | 'success' | 'error';
    resultUrl?: string;
    error?: string;
    timestamp: number;
    data?: any; // Full Supabase response
}

interface GenerationContextType {
    tasks: GenerationTask[];
    isGenerating: boolean;
    startGeneration: (type: GenerationType, params: any) => Promise<void>;
    clearTask: (id: string) => void;
    getTaskByType: (type: GenerationType) => GenerationTask | undefined;
}

const GenerationContext = createContext<GenerationContextType | undefined>(undefined);

export const GenerationProvider = ({ children }: { children: ReactNode }) => {
    const [tasks, setTasks] = useState<GenerationTask[]>([]);
    const { user, refreshCredits } = useAuth();

    const isGenerating = tasks.some(t => t.status === 'pending');

    const startGeneration = async (type: GenerationType, params: any) => {
        if (!user) {
            toast.error('Silakan login terlebih dahulu');
            return;
        }

        const taskId = Math.random().toString(36).substring(7);
        const newTask: GenerationTask = {
            id: taskId,
            type,
            prompt: params.prompt,
            status: 'pending',
            timestamp: Date.now(),
        };

        setTasks(prev => [newTask, ...prev]);

        // Start background process
        generate(newTask, params);
    };

    const generate = async (task: GenerationTask, params: any) => {
        try {
            console.log('Starting background generation:', task.id);

            const { data, error } = await supabase.functions.invoke('generate-ai', {
                body: {
                    ...params,
                    userId: user?.id, // Ensure userId is passed
                },
            });

            if (error) throw error;
            if (data.error) throw new Error(data.error);

            // Success
            setTasks(prev => prev.map(t =>
                t.id === task.id
                    ? { ...t, status: 'success', resultUrl: data.url, data: data }
                    : t
            ));

            await refreshCredits();
            toast.success(`${task.type === 'poster' ? 'Poster' : 'Infografis'} berhasil dibuat!`);

        } catch (error: any) {
            console.error('Generation Error:', error);
            setTasks(prev => prev.map(t =>
                t.id === task.id
                    ? { ...t, status: 'error', error: error.message || 'Gagal membuat gambar' }
                    : t
            ));
            toast.error(`Gagal membuat ${task.type}: ${error.message}`);
        }
    };

    const clearTask = (id: string) => {
        setTasks(prev => prev.filter(t => t.id !== id));
    };

    const getTaskByType = (type: GenerationType) => {
        // Get the most recent task for this type
        return tasks.filter(t => t.type === type).sort((a, b) => b.timestamp - a.timestamp)[0];
    };

    return (
        <GenerationContext.Provider value={{ tasks, isGenerating, startGeneration, clearTask, getTaskByType }}>
            {children}
        </GenerationContext.Provider>
    );
};

export const useGeneration = () => {
    const context = useContext(GenerationContext);
    if (context === undefined) {
        throw new Error('useGeneration must be used within a GenerationProvider');
    }
    return context;
};
