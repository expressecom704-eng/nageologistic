// Version 5.0 - ABSOLUTE FINAL RESTORATION
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { Package, TrendingUp, Users, AlertCircle, RefreshCw, Plus, Save, X, Trash2, Edit, FileText, Download, PieChart, BarChart } from 'lucide-react';
import { motion } from 'framer-motion';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, subMonths, subDays, isSameDay, format } from 'date-fns';

const AdminDashboard: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState('analytics');
  const [stats, setStats] = useState({ totalOrders: 0, dailySales: 0, revenue: 0, lowStock: 0, deliveryFees: 0 });
  
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);

  // Form States
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', category: '', quantity: 0, price: 0 });
  const [showAddOrder, setShowAddOrder] = useState(false);
  const [newOrder, setNewOrder] = useState({ 
    customer_name: '', 
    customer_phone: '', 
    delivery_location: '', 
    date_time: '', 
    delivery_cost: 0, 
    payment_status: 'Not Paid',
    assigned_to: '',
    items: [] as any[]
  });
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [assigningOrder, setAssigningOrder] = useState<string | null>(null);
  
  // Agent Edit States
  const [editingAgent, setEditingAgent] = useState<string | null>(null);
  const [editAgentData, setEditAgentData] = useState({ name: '', phone: '', agent_segment: '' });

  // Reporting States
  const [reportPeriod, setReportPeriod] = useState<'weekly' | 'monthly'>('weekly');

  const getReportStats = () => {
    const now = new Date();
    const interval = reportPeriod === 'weekly' 
      ? { start: startOfWeek(now), end: endOfWeek(now) }
      : { start: startOfMonth(now), end: endOfMonth(now) };

    const filteredOrders = orders.filter(o => isWithinInterval(new Date(o.date_time), interval));
    const filteredTx = transactions.filter(tx => isWithinInterval(new Date(tx.created_at), interval));
    
    const realizableOrders = filteredOrders.filter(o => o.status === 'Delivered' && o.payment_status === 'Paid');
    const unpaidOrders = filteredOrders.filter(o => o.payment_status === 'Not Paid');

    const agentStats = agents.map(agent => {
      const aOrders = filteredOrders.filter(o => o.assigned_to === agent.id);
      const delivered = aOrders.filter(o => o.status === 'Delivered').length;
      const earnings = filteredTx.filter(tx => tx.agent_id === agent.id && tx.status === 'Paid').reduce((sum, tx) => sum + (Number(tx.agent_earnings) || 0), 0);
      const successRate = aOrders.length > 0 ? (delivered / aOrders.length) * 100 : 0;
      return { name: agent.name, orderCount: aOrders.length, delivered, earnings, successRate };
    });

    // Daily Revenue Trend (Last 7 Days)
    const dailyTrend = Array.from({ length: 7 }, (_, i) => {
      const d = subDays(now, i);
      const dayOrders = orders.filter(o => isSameDay(new Date(o.date_time), d) && o.status === 'Delivered');
      return {
        date: format(d, 'MMM dd'),
        revenue: dayOrders.reduce((sum, o) => sum + (Number(o.total_value) || 0), 0)
      };
    }).reverse();

    // Category Distribution
    const categories = Array.from(new Set(products.map(p => p.category)));
    const categoryStats = categories.map(cat => {
      const catProds = products.filter(p => p.category === cat);
      const value = catProds.reduce((sum, p) => sum + ((p.quantity || 0) * (p.price || 0)), 0);
      return { name: cat, value };
    });

    return {
      totalOrders: filteredOrders.length,
      deliveredOrders: filteredOrders.filter(o => o.status === 'Delivered').length,
      pendingOrders: filteredOrders.filter(o => o.status === 'Pending').length,
      revenue: realizableOrders.reduce((sum, o) => sum + (Number(o.total_value) || 0), 0),
      unpaidAmount: unpaidOrders.reduce((sum, o) => sum + (Number(o.total_value) || 0), 0),
      transactionCount: filteredTx.length,
      totalStock: products.reduce((sum, p) => sum + (p.quantity || 0), 0),
      stockValue: products.reduce((sum, p) => sum + ((p.quantity || 0) * (p.price || 0)), 0),
      lowStockCount: products.filter(p => p.quantity < 10 && p.quantity > 0).length,
      outOfStockCount: products.filter(p => p.quantity === 0).length,
      agentStats,
      dailyTrend,
      categoryStats,
      // @ts-ignore
      topProducts: ((window as any).productPerf || []).map((p: any) => ({ 
        name: p.products?.name || 'Unknown', 
        count: p.total_units_sold 
      }))
    };
  };

  const generateReport = async (type: 'pdf' | 'image') => {
    const element = document.getElementById('report-container');
    if (!element) return;

    if (type === 'pdf') {
      const canvas = await html2canvas(element, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Nageo_Report_${reportPeriod}_${format(new Date(), 'yyyyMMdd')}.pdf`);
    } else {
      const canvas = await html2canvas(element, { scale: 2 });
      const link = document.createElement('a');
      link.download = `Nageo_Summary_${reportPeriod}_${format(new Date(), 'yyyyMMdd')}.png`;
      link.href = canvas.toDataURL();
      link.click();
    }
  };

  useEffect(() => {
    fetchData();

    const productSub = supabase.channel('public:products')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, fetchData)
      .subscribe();

    const orderSub = supabase.channel('public:orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchData)
      .subscribe();
      
    const userSub = supabase.channel('public:users')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, fetchData)
      .subscribe();

    const txSub = supabase.channel('public:transactions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, fetchData)
      .subscribe();

    return () => {
      supabase.removeChannel(productSub);
      supabase.removeChannel(orderSub);
      supabase.removeChannel(userSub);
      supabase.removeChannel(txSub);
    };
  }, []);

  const fetchData = async () => {
    const { data: prodData } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    const { data: orderData } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    const { data: agentData } = await supabase.from('users').select('*').eq('role', 'agent');
    // @ts-ignore
    const { data: perfData } = await supabase.from('product_performance_stats').select('*, products(name)').order('total_units_sold', { ascending: false }).limit(5);
    
    // @ts-ignore
    const { data: txData } = await supabase.from('transactions')
        .select('*, orders(code), users(name)')
        .order('created_at', { ascending: false });

    if (prodData) setProducts(prodData);
    if (agentData) setAgents(agentData);
    if (txData) setTransactions(txData);
    if (perfData) (window as any).productPerf = perfData; // Temporary store for getReportStats access
    
    if (orderData) {
      setOrders(orderData);
      const realizableOrders = orderData.filter(o => o.status === 'Delivered' && o.payment_status === 'Paid');
      setStats({
        totalOrders: orderData.length,
        dailySales: orderData.filter(o => new Date(o.created_at).toDateString() === new Date().toDateString()).length,
        revenue: realizableOrders.reduce((sum, o) => sum + (Number(o.total_value) || 0), 0),
        deliveryFees: realizableOrders.reduce((sum, o) => sum + (Number(o.delivery_cost) || 0), 0),
        lowStock: prodData ? prodData.filter(p => p.quantity < 10).length : 0
      });
    }
  };

  const handleCreateProduct = async () => {
    if (!newProduct.name || !newProduct.category) return;
    await supabase.from('products').insert([newProduct]);
    setShowAddProduct(false);
    setNewProduct({ name: '', category: '', quantity: 0, price: 0 });
  };

  const handleCreateOrder = async () => {
    if (!newOrder.customer_phone || !newOrder.delivery_location || !newOrder.date_time || !newOrder.assigned_to) {
       alert("Please fill all required mandatory fields.");
       return;
    }
    if (newOrder.items.length === 0) {
       alert("You must add at least one product.");
       return;
    }

    const computedTotalValue = newOrder.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const payload = { ...newOrder, total_value: computedTotalValue, status: 'Assigned' };
    delete (payload as any).items;

    // @ts-ignore
    const { data: insertedOrder, error } = await supabase.from('orders').insert([payload]).select().single();
    if (insertedOrder) {
       const mappedItems = newOrder.items.map(i => ({
          order_id: insertedOrder.id,
          product_id: i.product_id,
          quantity: i.quantity,
          price_at_time: i.price
       }));
       await supabase.from('order_items').insert(mappedItems);
    }
    setShowAddOrder(false);
    setNewOrder({ customer_name: '', customer_phone: '', delivery_location: '', date_time: '', delivery_cost: 0, payment_status: 'Not Paid', assigned_to: '', items: [] });
  };
  
  const handleAddItem = () => {
    const prod = products.find(p => p.id === selectedProduct);
    if (prod) {
      setNewOrder({ ...newOrder, items: [...newOrder.items, { product_id: prod.id, name: prod.name, price: prod.price, quantity: selectedQuantity }] });
      setSelectedProduct('');
      setSelectedQuantity(1);
    }
  };
  
  const handleUpdatePayment = async (orderId: string, payment_status: string) => {
    await supabase.from('orders').update({ payment_status }).eq('id', orderId);
  };

  const handleUpdateStatus = async (orderId: string, status: string) => {
    await supabase.from('orders').update({ status }).eq('id', orderId);
  };

  const unpaidOrders = orders.filter(o => o.payment_status === 'Not Paid');
  const groupedOrders = orders.reduce((groups, order) => {
    const dateStr = new Date(order.date_time).toLocaleDateString('en-GB');
    if (!groups[dateStr]) groups[dateStr] = [];
    groups[dateStr].push(order);
    return groups;
  }, {} as any);

  const handleAssignOrder = async (orderId: string, agentId: string) => {
    await supabase.from('orders').update({ assigned_to: agentId, status: 'Assigned' }).eq('id', orderId);
    setAssigningOrder(null);
  };
  
  const handleSaveAgent = async (agentId: string) => {
    await supabase.from('users').update({ name: editAgentData.name, phone: editAgentData.phone, agent_segment: editAgentData.agent_segment }).eq('id', agentId);
    setEditingAgent(null);
  };

  const handleDeleteAgent = async (agentId: string) => {
    const isConfirmed = confirm("Are you sure you want to delete this agent?");
    if (isConfirmed) {
      await supabase.from('users').delete().eq('id', agentId);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {unpaidOrders.length > 0 && (
        <div className="mb-6 p-4 rounded-xl flex items-center gap-3" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
          <AlertCircle color="var(--status-returned)" size={24} />
          <div>
            <h4 className="font-bold text-danger">{t('payment_reminder')}</h4>
            <p className="text-sm">{t('unpaid_orders_count', { count: unpaidOrders.length })}</p>
          </div>
        </div>
      )}

      <div className="stat-grid mb-8">
        {[
          { icon: <TrendingUp />, label: t('total_orders'), value: stats.totalOrders },
          { icon: <Package />, label: t('daily_sales'), value: stats.dailySales },
          { icon: <RefreshCw />, label: t('revenue_goods'), value: `${stats.revenue.toFixed(2)} XOF` },
          { icon: <Users />, label: t('total_delivery_fees'), value: `${stats.deliveryFees.toFixed(2)} XOF` },
        ].map((s, i) => (
          <div key={i} className="card stat-card">
            <div className="stat-icon">{s.icon}</div>
            <div>
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-4 mb-6 mt-8" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', overflowX: 'auto' }}>
        {[
          { id: 'analytics', label: t('dashboard') },
          { id: 'stock', label: t('stock') },
          { id: 'orders', label: t('orders') },
          { id: 'agents', label: 'Agents & Teams' },
          { id: 'reports', label: 'System Reports' }
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className="btn" style={{ background: activeTab === tab.id ? 'rgba(99, 102, 241, 0.2)' : 'transparent', color: activeTab === tab.id ? 'var(--color-primary)' : 'var(--text-muted)' }}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="card w-full">
        {activeTab === 'analytics' && (
          <div className="py-8 space-y-12">
            <div>
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <TrendingUp className="text-primary" /> {t('financial_overview')}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                 <div className="p-6 rounded-xl border border-[var(--border-color)] bg-white/5">
                    <h3 className="text-muted mb-2 uppercase text-xs tracking-wider">{t('product_revenue')}</h3>
                    <div className="text-2xl font-bold text-primary">{stats.revenue.toLocaleString()} XOF</div>
                    <div className="text-xs text-muted mt-1">Value of delivered goods</div>
                 </div>
                 <div className="p-6 rounded-xl border border-[var(--border-color)] bg-white/5">
                    <h3 className="text-muted mb-2 uppercase text-xs tracking-wider">Fees Collected</h3>
                    <div className="text-2xl font-bold text-secondary">{stats.deliveryFees.toLocaleString()} XOF</div>
                    <div className="text-xs text-muted mt-1">Total logistics payout</div>
                 </div>
                 <div className="p-6 rounded-xl border border-[var(--border-color)] bg-white/5">
                    <h3 className="text-muted mb-2 uppercase text-xs tracking-wider">Stock Value</h3>
                    <div className="text-2xl font-bold text-warning">{getReportStats().stockValue.toLocaleString()} XOF</div>
                    <div className="text-xs text-muted mt-1">Estimated warehouse value</div>
                 </div>
                 <div className="p-6 rounded-xl border border-[var(--border-color)] bg-white/5">
                    <h3 className="text-muted mb-2 uppercase text-xs tracking-wider">Unpaid Pipeline</h3>
                    <div className="text-2xl font-bold text-danger">{getReportStats().unpaidAmount.toLocaleString()} XOF</div>
                    <div className="text-xs text-muted mt-1">Orders awaiting payment</div>
                 </div>
              </div>
            </div>

            {/* Revenue Trend Visualization */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 card p-6">
                <h3 className="font-bold mb-6 flex items-center gap-2"><BarChart size={18} className="text-primary" /> Revenue Trend (Last 7 Days)</h3>
                <div className="h-64 w-full flex items-end gap-2 px-2">
                  {getReportStats().dailyTrend.map((day, idx) => {
                    const maxRevenue = Math.max(...getReportStats().dailyTrend.map(d => d.revenue)) || 1;
                    const height = (day.revenue / maxRevenue) * 100;
                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center group relative">
                        <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-primary text-white text-[10px] px-2 py-1 rounded-md font-bold whitespace-nowrap z-10 shadow-lg">
                          {day.revenue.toLocaleString()} XOF
                        </div>
                        <div 
                          className="w-full bg-primary/20 hover:bg-primary/40 rounded-t-md transition-all duration-500 ease-out flex items-end justify-center relative border-t-2 border-primary"
                          style={{ height: `${Math.max(height, 5)}%` }}
                        >
                          {day.revenue > 0 && <div className="w-1 h-full bg-primary/10 absolute top-0" />}
                        </div>
                        <span className="text-[10px] text-muted mt-3 font-medium uppercase tracking-tighter">{day.date}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="card p-6">
                <h3 className="font-bold mb-6 flex items-center gap-2"><PieChart size={18} className="text-secondary" /> Stock Distribution</h3>
                <div className="space-y-4">
                  {getReportStats().categoryStats.map((cat, idx) => {
                    const totalValue = getReportStats().stockValue || 1;
                    const percentage = (cat.value / totalValue) * 100;
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted font-medium uppercase">{cat.name}</span>
                          <span className="font-bold">{cat.value.toLocaleString()} XOF</span>
                        </div>
                        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${percentage}%` }}
                            className="h-full bg-secondary"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Agent Performance Table */}
            <div className="card overflow-hidden">
              <div className="p-6 border-b border-[var(--border-color)] flex justify-between items-center">
                <h3 className="font-bold flex items-center gap-2"><Users size={18} className="text-warning" /> Agent Performance Insights</h3>
              </div>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Agent Name</th>
                      <th>Total Orders</th>
                      <th>Delivered</th>
                      <th>Success Rate</th>
                      <th>Total Earnings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getReportStats().agentStats.map((agent, idx) => (
                      <tr key={idx}>
                        <td className="font-bold">{agent.name}</td>
                        <td>{agent.orderCount}</td>
                        <td>{agent.delivered}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden max-w-[60px]">
                              <div className="h-full bg-success" style={{ width: `${agent.successRate}%` }} />
                            </div>
                            <span className="text-xs font-bold text-success">{agent.successRate.toFixed(1)}%</span>
                          </div>
                        </td>
                        <td className="font-bold text-primary">{agent.earnings.toLocaleString()} XOF</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'stock' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">{t('stock')} {stats.lowStock > 0 && <span className="text-danger text-sm ml-2">({stats.lowStock} {t('low_stock')})</span>}</h2>
              <button className="btn btn-primary" onClick={() => setShowAddProduct(!showAddProduct)}>{showAddProduct ? <X size={18} /> : <Plus size={18} />} Add Product</button>
            </div>
            <div className="table-container">
              <table>
                <thead><tr><th>Category</th><th>Name</th><th>Quantity</th><th>Price</th><th>Value</th></tr></thead>
                <tbody>{products.map(p => (<tr key={p.id}><td>{p.category}</td><td className="font-medium">{p.name}</td><td>{p.quantity}</td><td>{p.price} XOF</td><td>{(p.quantity * p.price).toFixed(2)} XOF</td></tr>))}</tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">{t('orders')}</h2>
              <button className="btn btn-primary" onClick={() => setShowAddOrder(!showAddOrder)}>{showAddOrder ? <X size={18} /> : <Plus size={18} />} {t('manual_order')}</button>
            </div>
            {Object.keys(groupedOrders).map(date => (
              <div key={date} className="mb-8">
                <div className="px-4 py-3 bg-white/5 font-bold border-b border-white/10">{t('orders_for_date', { date })}</div>
                <div className="table-container">
                  <table>
                    <thead><tr><th>Code</th><th>Customer</th><th>Status</th><th>Payment</th><th>Agent</th><th>Total (XOF)</th></tr></thead>
                    <tbody>{groupedOrders[date].map((o: any) => (
                      <tr key={o.id}>
                        <td>{o.code}</td>
                        <td>{o.customer_phone}<br/><span className="text-xs text-muted">📍{o.delivery_location}</span></td>
                        <td><select className="text-xs font-bold" value={o.status} onChange={e => handleUpdateStatus(o.id, e.target.value)}><option value="Delivered">Delivered</option><option value="Pending">Pending</option><option value="Assigned">Assigned</option></select></td>
                        <td><select className="text-xs font-bold" value={o.payment_status} onChange={e => handleUpdatePayment(o.id, e.target.value)}><option value="Paid">Paid</option><option value="Not Paid">Not Paid</option></select></td>
                        <td>{agents.find(a => a.id === o.assigned_to)?.name || 'Unknown'}</td>
                        <td className="font-bold text-primary">{o.total_value}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'agents' && (
          <div>
            <h2 className="text-xl font-bold mb-6">{t('agents_management')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {agents.map(agent => (
                <div key={agent.id} className="p-5 rounded-xl border border-[var(--border-color)] bg-white/5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold">{agent.name.charAt(0)}</div>
                    <div>
                      <h3 className="font-bold">{agent.name}</h3>
                      <p className="text-xs text-muted">{agent.phone}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <div id="report-container">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold">Nageo Management Report</h2>
                <p className="text-muted text-sm">System performance & stock analytics</p>
              </div>
              <div className="flex gap-2">
                <button className="btn btn-secondary" onClick={() => generateReport('pdf')}><Download size={18}/> PDF</button>
                <button className="btn btn-secondary" onClick={() => setReportPeriod(reportPeriod === 'weekly' ? 'monthly' : 'weekly')}>{reportPeriod === 'weekly' ? 'Weekly' : 'Monthly'}</button>
              </div>
            </div>

            <div className="space-y-8 p-4 bg-white/5 rounded-2xl border border-white/10">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-4 rounded-xl bg-white/5 border-l-4 border-primary">
                  <div className="text-muted text-xs uppercase mb-1">Total Revenue</div>
                  <div className="text-2xl font-bold text-primary">{getReportStats().revenue.toFixed(2)} XOF</div>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border-l-4 border-success">
                  <div className="text-muted text-xs uppercase mb-1">Delivered</div>
                  <div className="text-2xl font-bold text-success">{getReportStats().deliveredOrders}</div>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border-l-4 border-danger">
                  <div className="text-muted text-xs uppercase mb-1">Unpaid Amount</div>
                  <div className="text-2xl font-bold text-danger">{getReportStats().unpaidAmount.toFixed(2)} XOF</div>
                </div>
              </div>
              
              <div className="mt-8 text-center text-xs text-muted">
                Generated on {new Date().toLocaleString()} | Nageo Management
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default AdminDashboard;
