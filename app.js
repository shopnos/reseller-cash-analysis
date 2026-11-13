const firebaseConfig = {
    apiKey: "AIzaSyAhK8f7kxo6RcqD-Ng8tWquqci8XE6qcgg",
    authDomain: "reseller-s-cash-analysis.firebaseapp.com",
    projectId: "reseller-s-cash-analysis",
    storageBucket: "reseller-s-cash-analysis.firebasestorage.app",
    messagingSenderId: "350736514918",
    appId: "1:350736514918:web:76d5352b7f2795171652a7"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const $ = id => document.getElementById(id);

let masterData = [], orderData = [];
let currentTimeFilter = 'all';
let chartInstance = null;
let currentUserId = null;
let isLoginMode = true;

// --- AUTHENTICATION LOGIC ---
function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    $('authTitle').innerText = isLoginMode ? '🔒 লগইন করুন' : '📝 রেজিস্ট্রেশন';
    $('authSubtitle').innerText = isLoginMode ? 'আপনার অ্যাকাউন্টে প্রবেশ করুন' : 'নতুন অ্যাকাউন্ট তৈরি করুন';
    $('authBtn').innerText = isLoginMode ? 'লগইন' : 'রেজিস্ট্রেশন';
    $('authToggleBtn').innerText = isLoginMode ? 'নতুন অ্যাকাউন্ট খুলুন' : 'আগে থেকেই অ্যাকাউন্ট আছে? লগইন করুন';
    $('authEmail').value = ''; $('authPassword').value = '';
}

async function handleAuth() {
    const email = $('authEmail').value.trim();
    const pass = $('authPassword').value;
    if(!email || pass.length < 6) return alert("সঠিক ইমেইল এবং কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড দিন।");

    $('authBtn').innerText = 'অপেক্ষা করুন...';

    try {
        if(isLoginMode) {
            await auth.signInWithEmailAndPassword(email, pass);
        } else {
            await auth.createUserWithEmailAndPassword(email, pass);
        }
    } catch (error) {
        alert("সমস্যা: " + error.message);
        $('authBtn').innerText = isLoginMode ? 'লগইন' : 'রেজিস্ট্রেশন';
    }
}

function logoutUser() { auth.signOut(); }

auth.onAuthStateChanged(user => {
    if (user) {
        currentUserId = user.uid;
        $('authOverlay').style.display = 'none';
        $('appContainer').classList.add('active');
        $('navBar').style.display = 'flex';
        $('logoutBtn').style.display = 'block';
        
        switchTab('tab-dashboard', document.querySelector('.nav-item[data-tab="tab-dashboard"]'));
        startListeners();
    } else {
        currentUserId = null;
        $('authOverlay').style.display = 'flex';
        $('appContainer').classList.remove('active');
        $('navBar').style.display = 'none';
        $('logoutBtn').style.display = 'none';
        masterData = []; orderData = [];
    }
});

// --- NAV & FILTERS ---
function switchTab(tabId, element) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    $(tabId).classList.add('active'); element.classList.add('active');
    if(tabId === 'tab-entry') renderOrders();
    if(tabId === 'tab-master') renderMaster();
}

function setTimeFilter(filter, btn) {
    currentTimeFilter = filter;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    updateDashboard();
}

// --- INIT & DATA FETCHING ---
function startListeners() {
    if(!currentUserId) return;

    db.collection('products').where('userId', '==', currentUserId).onSnapshot(snap => {
        masterData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderMaster(); renderDropdowns(); updateDashboard();
    });
    
    db.collection('analytics_orders').where('userId', '==', currentUserId).onSnapshot(snap => {
        orderData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderOrders(); updateDashboard();
    });
}

function renderDropdowns() {
    const dashSel = $('dashProductSelect');
    const entrySel = $('entryProduct');
    dashSel.innerHTML = '<option value="all">সামগ্রিক হিসাব (All Products)</option>';
    entrySel.innerHTML = '<option value="">-- সিলেক্ট --</option>';
    masterData.forEach(p => {
        dashSel.innerHTML += `<option value="${p.id}">${p.name}</option>`;
        entrySel.innerHTML += `<option value="${p.id}">${p.name}</option>`;
    });
}

// --- HELPER: DYNAMIC AD COST ---
function getProductAdCost(productId) {
    const p = masterData.find(x => x.id === productId);
    if (!p) return 0;
    const totalOrders = orderData.filter(o => o.productId === productId).length || 1;
    return p.adCost / totalOrders;
}

// --- MASTER DATA CRUD ---
function renderMaster() {
    const tbody = $('masterTableBody'); tbody.innerHTML = '';
    masterData.forEach(p => {
        tbody.innerHTML += `<tr>
            <td>${p.name}</td><td>৳${p.cost}</td><td>৳${p.adCost}</td>
            <td><button class="action-btn" onclick="editProd('${p.id}')">✏️</button><button class="action-btn" onclick="delProd('${p.id}')" style="color:var(--loss);">❌</button></td>
        </tr>`;
    });
}

$('productForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if(!currentUserId) return;
    const id = $('editProductId').value;
    const data = { 
        name: $('prodName').value.trim(), 
        cost: Number($('prodCost').value), 
        adCost: Number($('prodAdCost').value),
        userId: currentUserId
    };
    
    if(id) {
        delete data.userId; 
        await db.collection('products').doc(id).update({ name: data.name, cost: data.cost, adCost: data.adCost });
    } else {
        await db.collection('products').add(data);
    }
    cancelProdEdit(); alert('সেভ হয়েছে!');
});

function editProd(id) {
    const p = masterData.find(x => x.id === id);
    $('editProductId').value = p.id; $('prodName').value = p.name; $('prodCost').value = p.cost; $('prodAdCost').value = p.adCost;
    $('saveProdBtn').innerText = 'আপডেট'; $('cancelProdBtn').style.display = 'block'; window.scrollTo(0,0);
}
function cancelProdEdit() { $('productForm').reset(); $('editProductId').value = ''; $('saveProdBtn').innerText = 'সেভ করুন'; $('cancelProdBtn').style.display = 'none'; }
async function delProd(id) { if(confirm('মুছবেন?')) await db.collection('products').doc(id).delete(); }

// --- ORDER CRUD ---
function calcAdCost() {
    const p = masterData.find(x => x.id === $('entryProduct').value);
    if(p) { 
        $('adCost').value = getProductAdCost(p.id).toFixed(0); 
        checkWarning(); 
    }
}
function toggleReturn() {
    $('returnPayerDiv').style.display = $('orderStatus').value === 'Returned' ? 'block' : 'none';
}
function checkWarning() {
    const p = masterData.find(x => x.id === $('entryProduct').value);
    const sale = Number($('salePrice').value);
    if(p && sale > 0) {
        const cost = p.cost + getProductAdCost(p.id);
        if(sale < cost) {
            $('warningBanner').style.display = 'block';
            $('warningBanner').innerHTML = `⚠️ সতর্কতা: এই দামে অর্ডার নিলে আপনার <b>৳${(cost - sale).toFixed(0)}</b> লস হবে!`;
        } else $('warningBanner').style.display = 'none';
    } else $('warningBanner').style.display = 'none';
}

$('orderForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if(!currentUserId) return;
    const id = $('editOrderId').value;
    const status = $('orderStatus').value;
    
    let selectedDate = $('orderDate').value;
    if(!selectedDate) selectedDate = new Date().toISOString().split('T')[0];
    const timestamp = new Date(selectedDate).getTime();

    const data = {
        custName: $('custName').value.trim(), custPhone: $('custPhone').value.trim(),
        productId: $('entryProduct').value, salePrice: Number($('salePrice').value),
        deliveryArea: Number($('deliveryArea').value),
        status: status, returnPayer: status === 'Returned' ? $('returnPayer').value : 'none',
        timestamp: id ? orderData.find(o => o.id === id).timestamp : timestamp,
        userId: currentUserId
    };
    
    if(id) {
        data.timestamp = timestamp; 
        delete data.userId; 
        await db.collection('analytics_orders').doc(id).update(data);
    } else {
        await db.collection('analytics_orders').add(data);
    }
    cancelEdit(); alert('সেভ হয়েছে!');
});

function renderOrders() {
    const tbody = $('entryTableBody'); tbody.innerHTML = '';
    orderData.sort((a,b)=>b.timestamp-a.timestamp).forEach(o => {
        const p = masterData.find(prod => prod.id === o.productId);
        let profitText = '-', badgeClass = `badge-${o.status}`;
        
        if(p) {
            const adCost = getProductAdCost(p.id);
            if(o.status === 'Delivered') {
                const profit = o.salePrice - (p.cost + adCost);
                profitText = `<span class="${profit>=0?'text-profit':'text-loss'}" style="font-weight:bold;">৳${profit.toFixed(0)}</span>`;
            } else if(o.status === 'Returned') {
                const loss = adCost + (o.returnPayer === 'me' ? o.deliveryArea : 0);
                profitText = `<span class="text-loss" style="font-weight:bold;">-৳${loss.toFixed(0)}</span>`;
            }
        }

        tbody.innerHTML += `<tr>
            <td>${o.custName}</td>
            <td>${p?p.name:'Unknown'}</td>
            <td>৳${o.salePrice}</td>
            <td>${profitText}</td>
            <td><span class="badge ${badgeClass}" onclick="openQuickStatus('${o.id}','${o.status}','${o.returnPayer}')">${o.status}</span></td>
            <td>
                <button class="action-btn" onclick="editOrder('${o.id}')">✏️</button>
                <button class="action-btn" onclick="delOrder('${o.id}')" style="color:var(--loss);">❌</button>
            </td>
        </tr>`;
    });
}

function editOrder(id) {
    const o = orderData.find(x => x.id === id);
    $('editOrderId').value = o.id; 
    $('orderDate').value = new Date(o.timestamp).toISOString().split('T')[0]; 
    $('custName').value = o.custName; $('custPhone').value = o.custPhone;
    $('entryProduct').value = o.productId; $('salePrice').value = o.salePrice; 
    $('adCost').value = getProductAdCost(o.productId).toFixed(0);
    $('deliveryArea').value = o.deliveryArea; $('orderStatus').value = o.status; toggleReturn();
    if(o.status === 'Returned') $('returnPayer').value = o.returnPayer;
    $('saveOrderBtn').innerText = 'আপডেট'; $('cancelEditBtn').style.display = 'block'; window.scrollTo(0,0);
}
function cancelEdit() { 
    $('orderForm').reset(); 
    $('editOrderId').value = ''; 
    $('warningBanner').style.display='none'; 
    $('saveOrderBtn').innerText = 'সেভ করুন'; 
    $('cancelEditBtn').style.display = 'none'; 
    $('returnPayerDiv').style.display='none';
    $('orderDate').value = new Date().toISOString().split('T')[0];
}
async function delOrder(id) { if(confirm('মুছবেন?')) await db.collection('analytics_orders').doc(id).delete(); }

// --- QUICK STATUS ---
function openQuickStatus(id, status, payer) {
    $('qsOrderId').value = id; $('qsStatus').value = status; $('qsReturnPayer').value = payer || 'customer'; toggleQsReturn();
    $('quickStatusModal').classList.add('open');
}
function toggleQsReturn() { $('qsReturnDiv').style.display = $('qsStatus').value === 'Returned' ? 'block' : 'none'; }
async function saveQuickStatus() {
    const id = $('qsOrderId').value, status = $('qsStatus').value, payer = $('qsReturnPayer').value;
    await db.collection('analytics_orders').doc(id).update({ status, returnPayer: status === 'Returned' ? payer : 'none' });
    $('quickStatusModal').classList.remove('open'); alert('আপডেট হয়েছে!');
}

// --- DASHBOARD & ANALYTICS ---
function updateDashboard() {
    const productFilter = $('dashProductSelect').value;
    const now = new Date(); now.setHours(0,0,0,0); 

    let filtered = orderData.filter(o => {
        if(productFilter !== 'all' && o.productId !== productFilter) return false;
        if(currentTimeFilter === 'all') return true; // সব সময়

        const orderDate = new Date(o.timestamp); orderDate.setHours(0,0,0,0);
        if(currentTimeFilter === 'today') return orderDate.getTime() === now.getTime();
        if(currentTimeFilter === 'week') { const w = new Date(now); w.setDate(now.getDate() - 7); return orderDate >= w; }
        if(currentTimeFilter === 'month') { const m = new Date(now); m.setMonth(now.getMonth() - 1); return orderDate >= m; }
        return true; 
    });

    let grossProfit=0, net=0, adCost=0, totalReturnChargeMe=0, rVal=0, proc=0, deliv=0, ret=0;
    let procProfit=0, delivProfit=0, retLoss=0; 

    filtered.forEach(o => {
        const p = masterData.find(x => x.id === o.productId); if(!p) return;
        
        const currentAdCost = getProductAdCost(p.id); 
        adCost += currentAdCost;

        if(o.status === 'Processing') {
            proc++;
            procProfit += (o.salePrice - (p.cost + currentAdCost));
        }
        if(o.status === 'Delivered') {
            deliv++; 
            grossProfit += (o.salePrice - p.cost); 
            let oNet = (o.salePrice - (p.cost + currentAdCost));
            net += oNet; 
            delivProfit += oNet; 
        }
        if(o.status === 'Returned') {
            ret++; 
            rVal += o.salePrice; 
            let loss = currentAdCost; 
            if(o.returnPayer === 'me') {
                loss += o.deliveryArea;
                totalReturnChargeMe += o.deliveryArea; 
            }
            net -= loss;
            retLoss += loss; 
        }
    });

    // মোট লস = এডকস্ট - মোট লাভ + রিটার্ন চার্জ (আমি দিলে)
    const calculatedTotalLoss = adCost - grossProfit + totalReturnChargeMe;

    const margin = adCost > 0 ? ((net / adCost) * 100).toFixed(1) : 0; 
    const roas = adCost > 0 ? (grossProfit / adCost).toFixed(2) : 0; 
    const successRate = filtered.length > 0 ? ((deliv / filtered.length)*100).toFixed(0) : 0;
    const avgAdCost = filtered.length > 0 ? (adCost / filtered.length).toFixed(0) : 0;

    $('dash-gross-profit').innerText = '৳'+grossProfit.toLocaleString();
    $('dash-gross-sub').innerText = `${deliv} টি ডেলিভারি`;
    
    // মোট লস আপডেট (বাগ ফিক্স করা হয়েছে)
    if(calculatedTotalLoss > 0) {
        $('dash-net').className = 'stat-value text-loss glow-loss';
        $('dash-net').innerText = '৳' + calculatedTotalLoss.toLocaleString();
        $('dash-net-title').innerText = 'মোট লস'; 
    } else if (calculatedTotalLoss < 0) {
        $('dash-net').className = 'stat-value text-profit glow-profit';
        $('dash-net').innerText = '৳' + Math.abs(calculatedTotalLoss).toLocaleString();
        $('dash-net-title').innerText = 'মোট লাভ'; 
    } else {
        $('dash-net').className = 'stat-value';
        $('dash-net').innerText = '৳0';
        $('dash-net-title').innerText = 'মোট লস/লাভ';
    }
    $('dash-net').style.fontSize = '1.1rem';

    $('dash-margin').innerText = margin+'%'; 
    $('dash-margin').className = margin>=0 ? 'stat-value text-profit' : 'stat-value text-loss';
    $('margin-box').style.border = margin>=0 ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)';
    $('dash-margin-sub').innerText = `বিনিয়োগ: ৳${adCost.toLocaleString()}`; 
    
    $('dash-adcost').innerText = '৳'+adCost.toLocaleString(); 
    $('dash-adcost-sub').innerText = `(${filtered.length}টি অর্ডারের জন্য)`;
    $('dash-total-return').innerText = '৳'+totalReturnChargeMe.toLocaleString(); 
    $('dash-avg-adcost').innerText = '৳'+avgAdCost;
    
    // স্ট্যাটাস আপডেট
    $('dash-total-orders').innerText = filtered.length + ' টি';
    
    $('dash-processing').innerText = proc; 
    $('dash-processing-amt').innerText = '৳' + procProfit.toLocaleString() + ' (সম্ভাব্য লাভ)';
    
    $('dash-delivered').innerText = deliv; 
    $('dash-delivered-amt').innerText = '৳' + delivProfit.toLocaleString() + ' (প্রফিট)';
    
    $('dash-returned').innerText = ret;
    $('dash-returned-amt').innerText = '-৳' + retLoss.toLocaleString() + ' (লস)';
    
    $('dash-success-rate').innerText = successRate + '%';
    $('dash-roas').innerText = roas + 'x';

    drawChart(filtered);
}function drawChart(orders) {
    const ctx = document.getElementById('profitChart').getContext('2d');
    let labels = [], data = [];
    for(let i=6; i>=0; i--) {
        const d = new Date(Date.now() - i*86400000);
        labels.push(d.toLocaleDateString('en-GB', {day:'numeric', month:'short'}));
        let dayNet = 0;
        orders.forEach(o => {
            const od = new Date(o.timestamp);
            if(od.getDate()===d.getDate() && od.getMonth()===d.getMonth()) {
                const p = masterData.find(x=>x.id===o.productId); if(!p) return;
                const adC = getProductAdCost(p.id);
                if(o.status==='Delivered') dayNet += (o.salePrice - (p.cost + adC));
                else if(o.status==='Returned') dayNet -= (adC + (o.returnPayer==='me'?o.deliveryArea:0));
            }
        });
        data.push(dayNet);
    }
    if(chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, {
        type: 'line', 
        data: { labels, datasets: [{ data, borderColor: '#10b981', borderWidth: 2, tension: 0.3, pointBackgroundColor: '#38bdf8', backgroundColor: 'rgba(16, 185, 129, 0.1)', fill: true }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } }, x: { grid: { display: false }, ticks: { color: '#94a3b8' } } } }
    });
}

// --- PUBLIC VIEW MODAL ---
function openStatusList(status) {
    $('modalTitle').innerText = status + " লিস্ট";
    const cont = $('modalListContainer'); cont.innerHTML = '';
    const ords = orderData.filter(o => o.status === status);
    if(!ords.length) cont.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted);">খালি</div>';
    else ords.forEach(o => {
        cont.innerHTML += `<div style="padding:10px 0; border-bottom:1px dashed var(--border-color); display:flex; justify-content:space-between;">
            <div><b>${o.custName}</b><br><small style="color:var(--text-muted)">${o.custPhone}</small></div>
            <div style="font-weight:bold; color:var(--primary);">৳${o.salePrice}</div>
        </div>`;
    });
    $('statusModal').classList.add('open');
}

// --- EXPORT CSV ---
function exportToCSV() {
    if(!orderData.length) return alert("ডাউনলোড করার মতো কোনো ডেটা নেই!");
    let csvContent = "\uFEFF"; 
    csvContent += "Date,Customer,Phone,Product,Status,Sale Price,Ad Cost,Profit/Loss\n";
    orderData.forEach(o => {
        const p = masterData.find(prod => prod.id === o.productId);
        let profit = 0;
        const adC = p ? getProductAdCost(p.id) : 0;
        
        if(o.status === 'Delivered' && p) profit = o.salePrice - (p.cost + adC);
        else if(o.status === 'Returned') profit = -(adC + (o.returnPayer === 'me' ? o.deliveryArea : 0));
        
        const dateStr = new Date(o.timestamp).toLocaleDateString('en-GB');
        csvContent += `${dateStr},${o.custName},${o.custPhone},${p?p.name:''},${o.status},${o.salePrice},${adC.toFixed(0)},${profit.toFixed(0)}\n`;
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Analytics_${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// গ্লোবাল ফাংশন এক্সপোর্ট
window.toggleAuthMode = toggleAuthMode;
window.handleAuth = handleAuth;
window.logoutUser = logoutUser;
window.triggerExport = exportToCSV;
window.switchTab = switchTab;
window.setTimeFilter = setTimeFilter;
window.editProd = editProd;
window.cancelProdEdit = cancelProdEdit;
window.delProd = delProd;
window.calcAdCost = calcAdCost;
window.toggleReturn = toggleReturn;
window.checkWarning = checkWarning;
window.editOrder = editOrder;
window.cancelEdit = cancelEdit;
window.delOrder = delOrder;
window.openQuickStatus = openQuickStatus;
window.toggleQsReturn = toggleQsReturn;
window.saveQuickStatus = saveQuickStatus;
window.updateDashboard = updateDashboard;
window.openStatusList = openStatusList;
