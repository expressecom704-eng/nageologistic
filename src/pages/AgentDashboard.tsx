import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { MapPin, Phone, Package, CheckCircle, XCircle, AlertCircle, Truck, Clock } from 'lucide-react';
import { useStore } from '../store/useStore';
import { motion } from 'framer-motion';

const AgentDashboard: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { user } = useStore();
  const [assignedOrders, setAssignedOrders] = useState<any[]>([]);
  const [returnReason, setReturnReason] = useState<string>('Customer unavailable');
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'deliveries' | 'finances'>('deliveries');
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    if (user) fetchAssignedOrders();

    const orderSub = supabase.channel('public:orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        if (user) fetchAssignedOrders();
      })
      .subscribe();

    const txSub = supabase.channel('public:transactions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
        if (user) fetchAssignedOrders();
      })
      .subscribe();

    return () => { 
      supabase.removeChannel(orderSub); 
      supabase.removeChannel(txSub);
    };
  }, [user]);

  const fetchAssignedOrders = async () => {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('assigned_to', user?.id)
      .in('status', ['Assigned', 'Pending', 'In Progress']); // Hide delivered/returned automatically
      
    const { data: txData } = await supabase
      .from('transactions')
      .select('*, orders(code)')
      .eq('agent_id', user?.id)
      .order('created_at', { ascending: false });
      
    if (data) setAssignedOrders(data);
    if (txData) setTransactions(txData);
  };

  const handleUpdateStatus = async (orderId: string, status: string, reason?: string) => {
    if ((status === 'Returned' || status === 'Not Delivered') && !reason) return;
    
    await supabase.from('orders').update({ status }).eq('id', orderId);
    
    if ((status === 'Returned' || status === 'Not Delivered') && reason) {
      await supabase.from('returns').insert({ order_id: orderId, reason });
    }

    setSelectedOrder(null);
  };

  const unpaidOrdersCount = assignedOrders.filter(o => o.payment_status === 'Not Paid').length;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">{t('welcome')}</h2>

      {/* Payment Warning */}
      {unpaidOrdersCount > 0 && (
         <div className="mb-6 p-4 rounded-xl flex items-center gap-3" style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.5)' }}>
           <AlertCircle color="var(--status-returned)" size={28} />
           <div>
             <h4 className="font-bold text-danger uppercase tracking-wider text-sm">{t('action_required', 'Action Required')}</h4>
             <p className="text-sm">{t('agent_unpaid_warning_1', 'You have')} <b>{unpaidOrdersCount}</b> {t('agent_unpaid_warning_2', 'assigned deliveries strictly marked as')} <span className="text-danger font-bold">{t('payment_not_paid').toUpperCase()}</span>. {t('agent_unpaid_warning_3', 'Collect payment upon delivery.')}</p>
           </div>
         </div>
      )}

      <div className="flex bg-white/5 p-1 rounded-xl mb-6">
        <button 
          className="flex-1 py-2 text-sm font-bold uppercase rounded-lg transition-colors"
          style={{ background: activeTab === 'deliveries' ? 'rgba(255,255,255,0.1)' : 'transparent', color: activeTab === 'deliveries' ? 'white' : 'var(--text-muted)' }}
          onClick={() => setActiveTab('deliveries')}
        >
          {t('active_deliveries')}
        </button>
        <button 
          className="flex-1 py-2 text-sm font-bold uppercase rounded-lg transition-colors"
          style={{ background: activeTab === 'finances' ? 'rgba(255,255,255,0.1)' : 'transparent', color: activeTab === 'finances' ? 'white' : 'var(--text-muted)' }}
          onClick={() => setActiveTab('finances')}
        >
          {t('my_earnings')}
        </button>
      </div>

      {activeTab === 'deliveries' && (
      <>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="card text-center" style={{ background: 'var(--bg-surface-solid)' }}>
            <h3 className="text-3xl font-bold text-primary">{assignedOrders.length}</h3>
            <p className="text-muted text-sm uppercase tracking-wider">{t('active_deliveries')}</p>
          </div>
        </div>

        <div className="space-y-4">
        {assignedOrders.length === 0 ? (
          <div className="card text-center py-12 text-muted">
            <Package size={48} className="mx-auto mb-4 opacity-50" />
            <p>No active assignments ready for delivery.</p>
          </div>
        ) : (
          assignedOrders.map(order => (
            <div key={order.id} className="card flex flex-col gap-4 border-l-4" style={{ borderLeftColor: order.payment_status === 'Paid' ? 'var(--status-delivered)' : 'var(--status-returned)' }}>
              
              <div className="flex justify-between items-start border-b border-[var(--border-color)] pb-3">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                     <span className="badge badge-pending">{order.code}</span>
                     {order.payment_status === 'Not Paid' && <span className="badge badge-returned" style={{ padding: '0.1rem 0.5rem', fontSize: '0.6rem' }}>❌ {t('payment_not_paid').toUpperCase()}</span>}
                     {order.payment_status === 'Paid' && <span className="badge badge-delivered" style={{ padding: '0.1rem 0.5rem', fontSize: '0.6rem' }}>✅ {t('payment_paid').toUpperCase()}</span>}
                  </div>
                  
                  <h3 className="text-lg font-bold">{order.customer_name || 'Anonymous Customer'}</h3>
                  <div className="flex items-center gap-2 text-muted mt-1 text-sm">
                    <MapPin size={14} /> {order.delivery_location}
                  </div>
                  <div className="flex items-center gap-2 text-muted mt-1 text-sm">
                    <Phone size={14} /> {order.customer_phone}
                  </div>
                  <div className="flex items-center gap-2 text-primary mt-1 text-xs">
                    <Clock size={12} /> {new Date(order.date_time).toLocaleString(i18n.language === 'fr' ? 'fr-FR' : 'en-US')}
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="text-xl font-bold text-primary">{order.total_value} XOF</div>
                  <div className="text-sm text-muted">{t('fee_label')} {order.delivery_cost} XOF</div>
                  <div className="text-xs uppercase mt-2 px-2 py-1 bg-white/5 rounded text-center inline-block">
                    {order.status === 'Assigned' ? t('status_assigned') : order.status === 'In Progress' ? t('status_in_progress') : order.status === 'Pending' ? t('status_pending') : order.status}
                  </div>
                </div>
              </div>

              {selectedOrder === order.id ? (
                <div className="p-4 rounded-xl" style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <label className="input-label mb-2 block font-bold text-danger text-sm uppercase">{t('marking_undelivered_returned')}</label>
                  <label className="text-xs text-muted mb-1 block">{t('mandatory_reason_strategy')}</label>
                  <select 
                    className="input-field w-full mb-3" 
                    value={returnReason}
                    onChange={e => setReturnReason(e.target.value)}
                  >
                    <option value="Customer unavailable">{t('reason_customer_unavailable')}</option>
                    <option value="Wrong address">{t('reason_wrong_address')}</option>
                    <option value="Refused">{t('reason_refused')}</option>
                    <option value="Other">{t('reason_other')}</option>
                  </select>
                  
                  <div className="flex gap-2">
                    <button className="btn flex-1" style={{ background: 'var(--status-returned)', color: 'white' }} onClick={() => handleUpdateStatus(order.id, 'Returned', returnReason)}>
                      {t('log_return')}
                    </button>
                    <button className="btn btn-secondary flex-1" onClick={() => setSelectedOrder(null)}>{t('cancel')}</button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 mt-2">
                  {order.status !== 'In Progress' && (
                     <button onClick={() => handleUpdateStatus(order.id, 'In Progress')} className="btn flex-1" style={{ background: 'rgba(234, 179, 8, 0.15)', color: '#eab308' }}>
                       <Truck size={16} /> Progress
                     </button>
                  )}
                  {order.status === 'In Progress' && (
                     <button onClick={() => handleUpdateStatus(order.id, 'Delivered')} className="btn flex-1" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--status-delivered)' }}>
                       <CheckCircle size={16} /> {t('deliver_action')}
                     </button>
                  )}
                  
                  <button onClick={() => setSelectedOrder(order.id)} className="btn flex-1" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--status-returned)' }}>
                    <XCircle size={16} /> {t('return_action')}
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
      </>
      )}

      {activeTab === 'finances' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="card text-center" style={{ background: 'var(--bg-surface-solid)' }}>
              <h3 className="text-3xl font-bold" style={{ color: 'var(--status-delivered)' }}>
                {transactions.filter(t => t.status === 'Paid').reduce((sum, tx) => sum + Number(tx.agent_earnings), 0).toFixed(0)} <span className="text-sm">XOF</span>
              </h3>
              <p className="text-muted text-sm uppercase tracking-wider">{t('total_finalized_earnings')}</p>
            </div>
            <div className="card text-center" style={{ background: 'var(--bg-surface-solid)' }}>
              <h3 className="text-3xl font-bold" style={{ color: 'var(--status-returned)' }}>
                {transactions.filter(t => t.status === 'Cancelled').reduce((sum, tx) => sum + Number(tx.agent_earnings), 0).toFixed(0)} <span className="text-sm">XOF</span>
              </h3>
              <p className="text-muted text-sm uppercase tracking-wider">{t('reversed_cancelled')}</p>
            </div>
          </div>

          <h3 className="font-bold text-lg mb-2">{t('ledger_history')}</h3>
          {transactions.length === 0 ? (
            <div className="card text-center py-12 text-muted">
              <CheckCircle size={48} className="mx-auto mb-4 opacity-50" />
              <p>No finalized payouts yet.</p>
            </div>
          ) : (
            transactions.map(tx => (
              <div key={tx.id} className="card flex justify-between items-center" style={{ opacity: tx.status === 'Cancelled' ? 0.6 : 1, borderLeft: `4px solid ${tx.status === 'Paid' ? 'var(--status-delivered)' : 'var(--status-returned)'}` }}>
                <div>
                  <div className="font-mono text-sm font-bold text-primary">{tx.orders?.code || 'Order Purged'}</div>
                  <div className="text-xs text-muted">{new Date(tx.created_at).toLocaleString(i18n.language === 'fr' ? 'fr-FR' : 'en-US')}</div>
                  <div className="mt-1">
                    <span className="px-2 py-1 rounded text-xs font-bold uppercase tracking-wider" style={{ backgroundColor: tx.status === 'Paid' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: tx.status === 'Paid' ? 'var(--status-delivered)' : 'var(--status-returned)' }}>
                      {tx.status === 'Paid' ? t('payment_paid') : tx.status === 'Cancelled' ? t('cancel') : tx.status}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-muted">{t('delivery_payout')}</div>
                  <div className="text-2xl font-bold">{Number(tx.agent_earnings).toFixed(0)} XOF</div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </motion.div>
  );
};

export default AgentDashboard;
