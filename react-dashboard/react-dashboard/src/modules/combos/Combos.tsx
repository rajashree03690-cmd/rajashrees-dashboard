'use client';

import { useState } from 'react';
import ComboList from './components/ComboList';
import ComboForm from './components/ComboForm';

type ViewMode = 'list' | 'create' | 'edit';

export default function Combos() {
    const [mode, setMode] = useState<ViewMode>('list');
    const [comboId, setComboId] = useState<number | null>(null);

    if (mode === 'list') {
        return (
            <ComboList
                onCreate={() => setMode('create')}
                onEdit={(id) => {
                    setComboId(id);
                    setMode('edit');
                }}
            />
        );
    }

    return (
        <ComboForm
            comboId={comboId}
            onBack={() => {
                setComboId(null);
                setMode('list');
            }}
        />
    );
}
