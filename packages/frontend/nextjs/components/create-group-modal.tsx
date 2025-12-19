'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Loader2 } from 'lucide-react';
import { API, handleApiError } from '@/lib/api';

interface CreateGroupModalProps {
  isOpen: boolean;
  onCloseAction: () => void;
  onSubmitAction: (groupData: any) => void;
}

export default function CreateGroupModal({ isOpen, onCloseAction, onSubmitAction }: CreateGroupModalProps) {
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    capacity: '15',
    description: '',
    level: 'beginner',
    direction: '',
    hall_id: '',
    duration_minutes: '60',
  });

  const handleSubmit = async () => {
    if (!formData.name || !formData.direction) {
      alert('Пожалуйста, заполните название группы и направление');
      return;
    }

    setSubmitting(true);
    try {
      const groupData = {
        name: formData.name,
        hall_id: formData.hall_id ? parseInt(formData.hall_id) : null,
        main_teacher_id: null,
        start_time: null,
        capacity: parseInt(formData.capacity),
        duration_minutes: parseInt(formData.duration_minutes),
        recurring_days: null,
        class_name: formData.direction,
      };

      await onSubmitAction(groupData);

      setFormData({
        name: '',
        capacity: '15',
        description: '',
        level: 'beginner',
        direction: '',
        hall_id: '',
        duration_minutes: '60',
      });

    } catch (error) {
      console.error('Error creating group:', error);
      throw error;
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onCloseAction}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Создать новую группу
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-6">
          {}
          <div>
            <Label htmlFor="name">Название группы *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="Например: Начинающие танцоры"
              className="mt-1"
            />
          </div>

          {}
          <div>
            <Label htmlFor="direction">Направление *</Label>
            <Select value={formData.direction} onValueChange={(value) => handleInputChange('direction', value)}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Выберите направление" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ballet">Балет</SelectItem>
                <SelectItem value="contemporary">Современные танцы</SelectItem>
                <SelectItem value="hip-hop">Хип-хоп</SelectItem>
                <SelectItem value="latin">Латина</SelectItem>
                <SelectItem value="jazz">Джаз</SelectItem>
                <SelectItem value="street">Уличные танцы</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="level">Уровень</Label>
              <Select value={formData.level} onValueChange={(value) => handleInputChange('level', value)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Начинающий</SelectItem>
                  <SelectItem value="intermediate">Средний</SelectItem>
                  <SelectItem value="advanced">Продвинутый</SelectItem>
                  <SelectItem value="professional">Профессиональный</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="capacity">Вместимость</Label>
              <Input
                id="capacity"
                type="number"
                value={formData.capacity}
                onChange={(e) => handleInputChange('capacity', e.target.value)}
                className="mt-1"
                min="1"
                max="50"
              />
            </div>
          </div>

          {}
          <div>
            <Label htmlFor="duration">Продолжительность занятия (минуты)</Label>
            <Select value={formData.duration_minutes} onValueChange={(value) => handleInputChange('duration_minutes', value)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="45">45 минут</SelectItem>
                <SelectItem value="60">60 минут</SelectItem>
                <SelectItem value="90">90 минут</SelectItem>
                <SelectItem value="120">120 минут</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {}
          <div>
            <Label htmlFor="description">Описание (необязательно)</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Краткое описание группы и особенностей занятий"
              className="mt-1"
              rows={3}
            />
          </div>
        </div>

        {}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onCloseAction} disabled={submitting}>
            Отмена
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Создать группу
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}