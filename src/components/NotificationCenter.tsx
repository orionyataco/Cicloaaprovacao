import React, { useState } from 'react';
import { useStore, AppNotification, NotificationType } from '../store';
import { Bell, BellDot, X, Check, Trash2, UserPlus, Brain, Calendar, Info } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export function NotificationCenter() {
  const { notifications, markNotificationAsRead, deleteNotification } = useStore();
  const [isOpen, setIsOpen] = useState(false);

  const unreadCount = notifications.filter(n => !n.read).length;

  const typeIcons: Record<NotificationType, React.ReactNode> = {
    follow: <UserPlus className="w-4 h-4 text-blue-400" />,
    flashcard: <Brain className="w-4 h-4 text-purple-400" />,
    calendar: <Calendar className="w-4 h-4 text-emerald-400" />,
    system: <Info className="w-4 h-4 text-amber-400" />
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 hover:bg-zinc-900 rounded-xl transition-all group"
      >
        {unreadCount > 0 ? (
          <>
            <BellDot className="w-6 h-6 text-emerald-400 animate-pulse" />
            <span className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ring-2 ring-zinc-950">
              {unreadCount}
            </span>
          </>
        ) : (
          <Bell className="w-6 h-6 text-zinc-500 group-hover:text-zinc-300" />
        )}
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40 bg-transparent" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
              <h3 className="font-bold text-zinc-100 flex items-center gap-2">
                Notificações
                {unreadCount > 0 && <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full">recente</span>}
              </h3>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-zinc-800 rounded-lg text-zinc-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
              {notifications.length > 0 ? (
                notifications.map((notification) => (
                  <div 
                    key={notification.id}
                    className={cn(
                      "p-4 border-b border-zinc-800/50 flex gap-3 group transition-colors",
                      !notification.read ? "bg-emerald-500/[0.03]" : "hover:bg-zinc-800/30"
                    )}
                  >
                    <div className={cn(
                      "shrink-0 w-8 h-8 rounded-lg flex items-center justify-center",
                      notification.type === 'follow' && "bg-blue-500/10",
                      notification.type === 'flashcard' && "bg-purple-500/10",
                      notification.type === 'calendar' && "bg-emerald-500/10",
                      notification.type === 'system' && "bg-amber-500/10",
                    )}>
                      {typeIcons[notification.type]}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <p className={cn(
                          "text-sm font-semibold truncate",
                          !notification.read ? "text-zinc-100" : "text-zinc-400"
                        )}>
                          {notification.title}
                        </p>
                        <span className="text-[10px] text-zinc-600 shrink-0 mt-1">
                          {format(parseISO(notification.date), "dd MMM HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
                        {notification.message}
                      </p>
                      
                      <div className="flex items-center gap-3 mt-3">
                        {!notification.read && (
                          <button 
                            onClick={() => markNotificationAsRead(notification.id)}
                            className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors"
                          >
                            <Check className="w-3 h-3" /> MARCAR COMO LIDA
                          </button>
                        )}
                        <button 
                          onClick={() => deleteNotification(notification.id)}
                          className="text-[10px] font-bold text-zinc-600 hover:text-red-400 flex items-center gap-1 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" /> EXCLUIR
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-12 text-center">
                  <Bell className="w-12 h-12 text-zinc-800 mx-auto mb-3" />
                  <p className="text-zinc-600 text-sm font-medium">Tudo limpo por aqui!</p>
                  <p className="text-zinc-700 text-xs mt-1">Você não tem notificações no momento.</p>
                </div>
              )}
            </div>
            
            {notifications.length > 0 && (
              <div className="p-3 bg-zinc-900 border-t border-zinc-800 text-center">
                <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">
                  Notificações sincronizadas com a nuvem
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
