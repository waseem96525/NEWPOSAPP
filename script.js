// Data storage keys
const ITEMS_KEY = 'pos_inventory_items';
const SALES_KEY = 'pos_sales';
const CUSTOMERS_KEY = 'pos_customers';
const HELD_ORDERS_KEY = 'pos_held_orders';
const SETTINGS_KEY = 'pos_shop_settings';

// Global data
let items = [];
let sales = [];
let cart = [];
let customers = [];
let heldOrders = [];
let shopSettings = {};
let currentCustomer = { name: 'Walk-in Customer' };
let currentOrderNumber = 1;
let discount = 0;
let discountType = 'percentage';
let gstEnabled = true;
let gstRate = 18;

// DOM elements
const sections = document.querySelectorAll('.section');
const inventoryTable = document.getElementById('inventoryTable').querySelector('tbody');
const itemGrid = document.getElementById('itemGrid');
const cartList = document.getElementById('cartList');
const cartTotal = document.getElementById('cartTotal');
const addItemModal = document.getElementById('addItemModal');
const addItemForm = document.getElementById('addItemForm');

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    showSection('dashboard');
    renderInventoryTable();
    renderItemGrid();
    renderInvoiceTable();
    updateDashboard();
    updateInventoryStats();
    updateCategoryFilter();
    updateCart(); // Initialize cart display

    // Set initial GST values
    document.getElementById('gstEnabled').checked = gstEnabled;
    document.getElementById('gstRate').value = gstRate;
    document.getElementById('gstRateValue').textContent = gstRate;

    // Set default report dates
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    document.getElementById('reportFromDate').value = thirtyDaysAgo;
    document.getElementById('reportToDate').value = today;

    // Search functionality
    document.getElementById('itemSearch').addEventListener('input', filterItems);
    document.getElementById('inventorySearch').addEventListener('input', filterInventory);
    document.getElementById('categoryFilter').addEventListener('change', filterInventory);
    document.getElementById('barcodeInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') scanBarcode();
    });
    document.getElementById('customerSearch').addEventListener('input', filterCustomers);
    document.getElementById('gstEnabled').addEventListener('change', (e) => {
        gstEnabled = e.target.checked;
        updateCart();
    });
    document.getElementById('gstRate').addEventListener('input', (e) => {
        gstRate = parseFloat(e.target.value);
        document.getElementById('gstRateValue').textContent = gstRate;
        updateCart();
    });

    document.getElementById('settingsForm').addEventListener('submit', (e) => {
        e.preventDefault();
        shopSettings = {
            name: document.getElementById('shopName').value,
            address: document.getElementById('shopAddress').value,
            phone: document.getElementById('shopPhone').value,
            email: document.getElementById('shopEmail').value,
            gst: document.getElementById('shopGST').value,
            website: document.getElementById('shopWebsite').value,
            logo: document.getElementById('shopLogo').value
        };
        saveData();
        closeModal();
        alert('Settings saved!');
    });
});

// Show section function
function showSection(sectionId) {
    sections.forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(sectionId).classList.add('active');
}

// Data persistence functions
function loadData() {
    items = JSON.parse(localStorage.getItem(ITEMS_KEY)) || [];
    sales = JSON.parse(localStorage.getItem(SALES_KEY)) || [];
    customers = JSON.parse(localStorage.getItem(CUSTOMERS_KEY)) || [];
    heldOrders = JSON.parse(localStorage.getItem(HELD_ORDERS_KEY)) || [];
    shopSettings = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
    currentOrderNumber = sales.length + 1;

    // Migrate old items to new structure
    items = items.map(item => ({
        id: item.id,
        name: item.name,
        sku: item.sku || '',
        barcode: item.barcode || '',
        hsn: item.hsn || '',
        category: item.category || '',
        costPrice: item.costPrice || item.price || 0,
        sellingPrice: item.sellingPrice || item.price || 0,
        mrp: item.mrp || item.price || 0,
        quantity: item.quantity || 0,
        minStock: item.minStock || 0,
        supplier: item.supplier || '',
        lastUpdated: item.lastUpdated || new Date().toISOString()
    }));

    // Migrate old sales to new structure
    sales = sales.map(sale => ({
        id: sale.id,
        orderNumber: sale.orderNumber || sale.id,
        date: sale.date,
        customer: sale.customer || { name: 'Walk-in Customer' },
        items: sale.items,
        subtotal: sale.subtotal || (sale.items.reduce((sum, item) => sum + (item.price * item.quantity), 0)),
        discount: sale.discount || 0,
        gstRate: sale.gstRate || 18,
        tax: sale.tax || ((sale.subtotal || (sale.items.reduce((sum, item) => sum + (item.price * item.quantity), 0) - (sale.discount || 0))) * ((sale.gstRate || 18) / 100)),
        total: sale.total,
        paymentMethod: sale.paymentMethod || 'cash',
        status: sale.status || 'paid'
    }));
}

function saveData() {
    localStorage.setItem(ITEMS_KEY, JSON.stringify(items));
    localStorage.setItem(SALES_KEY, JSON.stringify(sales));
    localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(customers));
    localStorage.setItem(HELD_ORDERS_KEY, JSON.stringify(heldOrders));
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(shopSettings));
}

// Inventory management
function renderInventoryTable(filteredItems = items) {
    inventoryTable.innerHTML = '';
    filteredItems.forEach((item) => {
        const status = item.quantity <= item.minStock ? 'Low Stock' : 'In Stock';
        const statusClass = status === 'Low Stock' ? 'low-stock' : 'in-stock';
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.name}</td>
            <td>${item.sku}</td>
            <td>${item.barcode || 'N/A'}</td>
            <td>${item.hsn || 'N/A'}</td>
            <td>${item.category}</td>
            <td>₹${item.costPrice.toFixed(2)}</td>
            <td>₹${item.sellingPrice.toFixed(2)}</td>
            <td>₹${item.mrp.toFixed(2)}</td>
            <td>${item.quantity}</td>
            <td>${item.minStock}</td>
            <td>${item.supplier || 'N/A'}</td>
            <td class="${statusClass}">${status}</td>
            <td>
                <button onclick="editItem(${item.id})">Edit</button>
                <button class="danger" onclick="deleteItem(${item.id})">Delete</button>
            </td>
        `;
        inventoryTable.appendChild(row);
    });
}

function showAddItemForm() {
    document.getElementById('itemName').value = '';
    document.getElementById('itemSKU').value = '';
    document.getElementById('itemBarcode').value = '';
    document.getElementById('itemHSN').value = '';
    document.getElementById('itemCategory').value = '';
    document.getElementById('itemCostPrice').value = '';
    document.getElementById('itemSellingPrice').value = '';
    document.getElementById('itemMRP').value = '';
    document.getElementById('itemQuantity').value = '';
    document.getElementById('itemMinStock').value = '';
    document.getElementById('itemSupplier').value = '';
    addItemModal.style.display = 'block';
}

function closeModal() {
    document.getElementById('addItemModal').style.display = 'none';
    document.getElementById('bulkActionsModal').style.display = 'none';
    document.getElementById('customerModal').style.display = 'none';
    document.getElementById('paymentModal').style.display = 'none';
    document.getElementById('discountModal').style.display = 'none';
    document.getElementById('receiptModal').style.display = 'none';
    document.getElementById('invoiceModal').style.display = 'none';
    document.getElementById('settingsModal').style.display = 'none';
}

addItemForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('itemName').value;
    const sku = document.getElementById('itemSKU').value;
    const barcode = document.getElementById('itemBarcode').value;
    const hsn = document.getElementById('itemHSN').value;
    const category = document.getElementById('itemCategory').value;
    const costPrice = parseFloat(document.getElementById('itemCostPrice').value);
    const sellingPrice = parseFloat(document.getElementById('itemSellingPrice').value);
    const mrp = parseFloat(document.getElementById('itemMRP').value);
    const quantity = parseInt(document.getElementById('itemQuantity').value);
    const minStock = parseInt(document.getElementById('itemMinStock').value);
    const supplier = document.getElementById('itemSupplier').value;

    if (name && sku && category && costPrice >= 0 && sellingPrice > 0 && mrp > 0 && quantity >= 0 && minStock >= 0) {
        const id = Date.now();
        items.push({ id, name, sku, barcode, hsn, category, costPrice, sellingPrice, mrp, quantity, minStock, supplier, lastUpdated: new Date().toISOString() });
        saveData();
        renderInventoryTable();
        renderItemGrid();
        updateDashboard();
        updateInventoryStats();
        updateCategoryFilter();
        closeModal();
    }
});

function editItem(id) {
    const item = items.find(i => i.id === id);
    const index = items.indexOf(item);
    const newName = prompt('Enter new name:', item.name);
    const newSKU = prompt('Enter new SKU:', item.sku);
    const newBarcode = prompt('Enter new barcode:', item.barcode);
    const newHSN = prompt('Enter new HSN:', item.hsn);
    const newCategory = prompt('Enter new category:', item.category);
    const newCostPrice = parseFloat(prompt('Enter new cost price:', item.costPrice));
    const newSellingPrice = parseFloat(prompt('Enter new selling price:', item.sellingPrice));
    const newMRP = parseFloat(prompt('Enter new MRP:', item.mrp));
    const newQuantity = parseInt(prompt('Enter new quantity:', item.quantity));
    const newMinStock = parseInt(prompt('Enter new min stock:', item.minStock));
    const newSupplier = prompt('Enter new supplier:', item.supplier);

    if (newName && newSKU && newCategory && newCostPrice >= 0 && newSellingPrice > 0 && newMRP > 0 && newQuantity >= 0 && newMinStock >= 0) {
        items[index] = { id, name: newName, sku: newSKU, barcode: newBarcode, hsn: newHSN, category: newCategory, costPrice: newCostPrice, sellingPrice: newSellingPrice, mrp: newMRP, quantity: newQuantity, minStock: newMinStock, supplier: newSupplier, lastUpdated: new Date().toISOString() };
        saveData();
        renderInventoryTable();
        renderItemGrid();
        updateDashboard();
        updateInventoryStats();
        updateCategoryFilter();
    }
}

function deleteItem(id) {
    const index = items.findIndex(i => i.id === id);
    if (confirm('Are you sure you want to delete this item?')) {
        items.splice(index, 1);
        saveData();
        renderInventoryTable();
        renderItemGrid();
        updateDashboard();
        updateInventoryStats();
        updateCategoryFilter();
    }
}

// Dashboard
function updateDashboard() {
    document.getElementById('totalItems').textContent = items.length;
    document.getElementById('totalSales').textContent = sales.length;
    const lowStock = items.filter(item => item.minStock && item.quantity <= item.minStock).length;
    document.getElementById('lowStock').textContent = lowStock;
    const totalRevenue = sales.reduce((sum, sale) => sum + sale.total, 0);
    document.getElementById('totalRevenue').textContent = `₹${totalRevenue.toFixed(2)}`;
}

// Inventory Stats
function updateInventoryStats() {
    const totalItems = items.length;
    const totalValue = items.reduce((sum, item) => sum + (item.costPrice * item.quantity), 0);
    const lowStockCount = items.filter(item => item.minStock && item.quantity <= item.minStock).length;

    document.getElementById('totalInventoryItems').textContent = totalItems;
    document.getElementById('totalInventoryValue').textContent = `₹${totalValue.toFixed(2)}`;
    document.getElementById('lowStockCount').textContent = lowStockCount;
}

// POS functionality
function renderItemGrid() {
    itemGrid.innerHTML = '';
    items.forEach((item) => {
        const itemCard = document.createElement('div');
        itemCard.className = 'item-card';
        itemCard.innerHTML = `
            <h4>${item.name}</h4>
            <p>₹${item.sellingPrice.toFixed(2)}</p>
            <p>Stock: ${item.quantity}</p>
            <button onclick="addToCart(${item.id})" ${item.quantity === 0 ? 'disabled' : ''}>Add to Cart</button>
        `;
        itemGrid.appendChild(itemCard);
    });
}

function addToCart(id) {
    const item = items.find(i => i.id === id);
    if (item && item.quantity > 0) {
        const cartItem = cart.find(ci => ci.id === id);
        if (cartItem) {
            cartItem.quantity++;
        } else {
            cart.push({ id, quantity: 1, price: item.sellingPrice });
        }
        item.quantity--;
        updateCart();
        saveData();
        renderItemGrid();
    }
}

function updateCart() {
    cartList.innerHTML = '';
    let subtotal = 0;
    cart.forEach((cartItem, cartIndex) => {
        const item = items.find(i => i.id === cartItem.id);
        const li = document.createElement('li');
        li.innerHTML = `
            <div>
                <strong>${item.name}</strong><br>
                ₹${cartItem.price.toFixed(2)} x ${cartItem.quantity}
            </div>
            <div>
                ₹${(cartItem.price * cartItem.quantity).toFixed(2)}
                <button onclick="changeQuantity(${cartIndex}, -1)">-</button>
                <button onclick="changeQuantity(${cartIndex}, 1)">+</button>
                <button onclick="removeFromCart(${cartIndex})">×</button>
            </div>
        `;
        cartList.appendChild(li);
        subtotal += cartItem.price * cartItem.quantity;
    });

    const discountAmount = discountType === 'percentage' ? (subtotal * discount / 100) : discount;
    const discountedTotal = subtotal - discountAmount;
    const taxAmount = gstEnabled ? (discountedTotal * gstRate / 100) : 0;
    const total = discountedTotal + taxAmount;

    document.getElementById('subtotal').textContent = subtotal.toFixed(2);
    document.getElementById('discountAmount').textContent = discountAmount.toFixed(2);
    document.getElementById('taxAmount').textContent = taxAmount.toFixed(2);
    document.getElementById('cartTotal').textContent = total.toFixed(2);
    document.getElementById('orderNumber').textContent = currentOrderNumber.toString().padStart(3, '0');
    document.getElementById('gstPercent').textContent = gstRate;
    document.getElementById('taxRow').style.display = gstEnabled ? 'flex' : 'none';
}

function changeQuantity(cartIndex, delta) {
    const cartItem = cart[cartIndex];
    const item = items.find(i => i.id === cartItem.id);
    if (delta > 0 && item.quantity > 0) {
        cartItem.quantity += delta;
        item.quantity -= delta;
    } else if (delta < 0 && cartItem.quantity > 1) {
        cartItem.quantity += delta;
        item.quantity -= delta;
    }
    updateCart();
    saveData();
    renderItemGrid();
}

function removeFromCart(cartIndex) {
    const cartItem = cart[cartIndex];
    const item = items.find(i => i.id === cartItem.id);
    item.quantity += cartItem.quantity;
    cart.splice(cartIndex, 1);
    updateCart();
    saveData();
    renderItemGrid();
}

function clearCart() {
    // Restore stock only if canceling, not after payment
    cart.forEach(cartItem => {
        const item = items.find(i => i.id === cartItem.id);
        item.quantity += cartItem.quantity;
    });
    cart = [];
    discount = 0;
    updateCart();
    saveData();
    renderItemGrid();
}

function selectCustomer() {
    document.getElementById('customerModal').style.display = 'block';
    renderCustomerList();
}

function renderCustomerList() {
    const customerList = document.getElementById('customerList');
    customerList.innerHTML = '';
    customers.forEach((customer, index) => {
        const div = document.createElement('div');
        div.className = 'customer-item';
        div.innerHTML = `
            <span>${customer.name} - ${customer.phone}</span>
            <button onclick="setCurrentCustomer(${index})">Select</button>
        `;
        customerList.appendChild(div);
    });
}

function setCurrentCustomer(index) {
    currentCustomer = customers[index];
    document.getElementById('customerName').textContent = currentCustomer.name;
    closeModal();
}

function addNewCustomer() {
    const name = prompt('Enter customer name:');
    const phone = prompt('Enter phone number:');
    if (name && phone) {
        customers.push({ name, phone });
        saveData();
        renderCustomerList();
    }
}

function holdOrder() {
    if (cart.length === 0) {
        alert('Cart is empty!');
        return;
    }
    const order = {
        id: currentOrderNumber,
        customer: currentCustomer,
        cart: cart,
        discount: discount,
        discountType: discountType,
        heldAt: new Date().toISOString()
    };
    heldOrders.push(order);
    saveData();
    clearCart();
    currentOrderNumber++;
    alert('Order held!');
}

function recallOrder() {
    if (heldOrders.length === 0) {
        alert('No held orders!');
        return;
    }
    // For simplicity, recall the last held order
    const order = heldOrders.pop();
    currentCustomer = order.customer;
    cart = order.cart;
    discount = order.discount;
    discountType = order.discountType;
    document.getElementById('customerName').textContent = currentCustomer.name;
    updateCart();
    saveData();
    renderItemGrid();
    alert('Order recalled!');
}

function applyDiscount() {
    document.getElementById('discountModal').style.display = 'block';
}

function applyDiscountToCart() {
    const value = parseFloat(document.getElementById('discountValue').value);
    discountType = document.getElementById('discountType').value;
    discount = value;
    updateCart();
    closeModal();
}

function checkout() {
    if (cart.length === 0) {
        alert('Cart is empty!');
        return;
    }
    const subtotal = parseFloat(document.getElementById('subtotal').textContent);
    const discountAmount = parseFloat(document.getElementById('discountAmount').textContent);
    const taxAmount = parseFloat(document.getElementById('taxAmount').textContent);
    const total = parseFloat(cartTotal.textContent);

    // Open payment modal
    document.getElementById('paymentModal').style.display = 'block';
    document.getElementById('paymentTotal').textContent = total.toFixed(2);
    document.getElementById('paidAmount').textContent = '0.00';
    document.getElementById('changeAmount').textContent = '0.00';
}

function selectPaymentMethod(method) {
    // For simplicity, assume full payment
    const total = parseFloat(document.getElementById('paymentTotal').textContent);
    document.getElementById('paidAmount').textContent = total.toFixed(2);
    document.getElementById('changeAmount').textContent = '0.00';
    processPayment(method);
}

function processPayment(method) {
    const total = parseFloat(cartTotal.textContent);
    const sale = {
        id: Date.now(),
        orderNumber: currentOrderNumber,
        date: new Date().toISOString(),
        customer: currentCustomer,
        items: cart.map(ci => {
            const item = items.find(i => i.id === ci.id);
            return {
                name: item.name,
                sku: item.sku,
                quantity: ci.quantity,
                price: ci.price
            };
        }),
        subtotal: parseFloat(document.getElementById('subtotal').textContent),
        discount: parseFloat(document.getElementById('discountAmount').textContent),
        gstRate: gstEnabled ? gstRate : 0,
        tax: parseFloat(document.getElementById('taxAmount').textContent),
        total: total,
        paymentMethod: method,
        status: 'paid'
    };
    sales.push(sale);
    saveData();
    printReceipt(sale);
    cart = [];
    discount = 0;
    updateCart();
    currentOrderNumber++;
    updateDashboard();
    renderInvoiceTable();
    closeModal();
    renderItemGrid(); // Update item grid to show reduced stock
    alert('Sale completed!');
}

function printReceipt(sale) {
    const shopHeader = shopSettings.name ? `
        <div style="text-align: center; margin-bottom: 10px;">
            ${shopSettings.logo ? `<img src="${shopSettings.logo}" style="max-width: 100px; max-height: 50px;"><br>` : ''}
            <div style="font-size: 18px; font-weight: bold;">${shopSettings.name}</div>
            ${shopSettings.address ? `<div>${shopSettings.address.replace(/\n/g, '<br>')}</div>` : ''}
            ${shopSettings.phone ? `<div>Phone: ${shopSettings.phone}</div>` : ''}
            ${shopSettings.email ? `<div>Email: ${shopSettings.email}</div>` : ''}
            ${shopSettings.gst ? `<div>GST: ${shopSettings.gst}</div>` : ''}
            ${shopSettings.website ? `<div>${shopSettings.website}</div>` : ''}
        </div>
        <hr style="border: none; border-top: 1px solid #000; margin: 10px 0;">
    ` : '';

    const receiptHTML = `
        <div style="font-family: Arial, sans-serif; text-align: center; max-width: 300px; margin: 0 auto;">
            ${shopHeader}
            <div style="font-size: 16px; font-weight: bold; margin-bottom: 5px;">Receipt #${sale.orderNumber}</div>
            <div>Date: ${new Date(sale.date).toLocaleString()}</div>
            <div>Customer: ${sale.customer.name}</div>
            <br>
            ${sale.items.map(item => `<div style="display: flex; justify-content: space-between; margin: 3px 0;"><span>${item.name} x${item.quantity}</span><span>₹${(item.price * item.quantity).toFixed(2)}</span></div>`).join('')}
            <br>
            <div style="display: flex; justify-content: space-between;"><span>Subtotal:</span><span>₹${sale.subtotal.toFixed(2)}</span></div>
            <div style="display: flex; justify-content: space-between;"><span>Discount:</span><span>-₹${sale.discount.toFixed(2)}</span></div>
            <div style="display: flex; justify-content: space-between;"><span>GST (${sale.gstRate}%):</span><span>₹${sale.tax.toFixed(2)}</span></div>
            <div style="border-top: 1px solid #000; padding-top: 5px; font-weight: bold; display: flex; justify-content: space-between;"><span>Total:</span><span>₹${sale.total.toFixed(2)}</span></div>
            <br>
            <div>Payment: ${sale.paymentMethod}</div>
            <br>
            <div style="font-size: 12px;">Thank you for your business!</div>
        </div>
    `;

    // Open print window directly
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
        <head>
            <title>Receipt</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                @media print { body { margin: 0; } }
            </style>
        </head>
        <body>${receiptHTML}</body>
        </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();

    // Also show modal for reference
    document.getElementById('receiptContent').innerHTML = receiptHTML;
    document.getElementById('receiptModal').style.display = 'block';
}

function scanBarcode() {
    const barcode = document.getElementById('barcodeInput').value;
    if (barcode) {
        const item = items.find(i => i.barcode === barcode);
        if (item) {
            addToCart(item.id);
            document.getElementById('barcodeInput').value = '';
        } else {
            alert('Item not found!');
        }
    }
}

function filterCustomers() {
    const query = document.getElementById('customerSearch').value.toLowerCase();
    const filteredCustomers = customers.filter(c => c.name.toLowerCase().includes(query) || c.phone.includes(query));
    renderFilteredCustomerList(filteredCustomers);
}

function renderFilteredCustomerList(filteredCustomers) {
    const customerList = document.getElementById('customerList');
    customerList.innerHTML = '';
    filteredCustomers.forEach((customer, index) => {
        const originalIndex = customers.indexOf(customer);
        const div = document.createElement('div');
        div.className = 'customer-item';
        div.innerHTML = `
            <span>${customer.name} - ${customer.phone}</span>
            <button onclick="setCurrentCustomer(${originalIndex})">Select</button>
        `;
        customerList.appendChild(div);
    });
}

// Billing system
function renderInvoiceTable() {
    const invoiceTableBody = document.getElementById('invoiceTable').querySelector('tbody');
    invoiceTableBody.innerHTML = '';
    sales.forEach((sale, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${sale.id}</td>
            <td>${new Date(sale.date).toLocaleDateString()}</td>
            <td>₹${sale.total.toFixed(2)}</td>
            <td>${sale.status}</td>
            <td>
                <button onclick="viewInvoice(${index})">View</button>
                <button onclick="printInvoice(${index})">Print</button>
                <button onclick="changeInvoiceStatus(${index})">Change Status</button>
            </td>
        `;
        invoiceTableBody.appendChild(row);
    });
}

function viewInvoice(index) {
    const sale = sales[index];
    const invoiceHTML = `
        <div style="font-family: Arial, sans-serif;">
            <div><strong>Invoice ID:</strong> ${sale.id}</div>
            <div><strong>Date:</strong> ${new Date(sale.date).toLocaleString()}</div>
            <div><strong>Customer:</strong> ${sale.customer.name}</div>
            <div><strong>Status:</strong> ${sale.status}</div>
            <br>
            <div><strong>Items:</strong></div>
            ${sale.items.map(item => `<div>${item.name} x${item.quantity} - ₹${(item.price * item.quantity).toFixed(2)}</div>`).join('')}
            <br>
            <div><strong>Subtotal:</strong> ₹${sale.subtotal.toFixed(2)}</div>
            <div><strong>Discount:</strong> ₹${sale.discount.toFixed(2)}</div>
            <div><strong>GST (${sale.gstRate}%):</strong> ₹${sale.tax.toFixed(2)}</div>
            <div><strong>Total:</strong> ₹${sale.total.toFixed(2)}</div>
            <div><strong>Payment:</strong> ${sale.paymentMethod}</div>
        </div>
    `;
    document.getElementById('invoiceContent').innerHTML = invoiceHTML;
    document.getElementById('invoiceModal').style.display = 'block';
}

function printInvoice(index) {
    const sale = sales[index];
    const shopHeader = shopSettings.name ? `
        <div style="text-align: center; margin-bottom: 10px;">
            ${shopSettings.logo ? `<img src="${shopSettings.logo}" style="max-width: 150px; max-height: 75px;"><br>` : ''}
            <div style="font-size: 20px; font-weight: bold;">${shopSettings.name}</div>
            ${shopSettings.address ? `<div>${shopSettings.address.replace(/\n/g, '<br>')}</div>` : ''}
            ${shopSettings.phone ? `<div>Phone: ${shopSettings.phone}</div>` : ''}
            ${shopSettings.email ? `<div>Email: ${shopSettings.email}</div>` : ''}
            ${shopSettings.gst ? `<div>GST: ${shopSettings.gst}</div>` : ''}
            ${shopSettings.website ? `<div>${shopSettings.website}</div>` : ''}
        </div>
        <hr style="border: none; border-top: 1px solid #000; margin: 10px 0;">
    ` : '';

    const invoiceHTML = `
        <div style="font-family: Arial, sans-serif; max-width: 400px; margin: 0 auto;">
            ${shopHeader}
            <div style="text-align: center; font-size: 18px; font-weight: bold; margin-bottom: 10px;">Invoice #${sale.id}</div>
            <div>Date: ${new Date(sale.date).toLocaleString()}</div>
            <div>Customer: ${sale.customer.name}</div>
            <div>Status: ${sale.status}</div>
            <br>
            <div>
                <strong>Items:</strong><br>
                ${sale.items.map(item => `${item.name} x${item.quantity} - ₹${(item.price * item.quantity).toFixed(2)}<br>`).join('')}
            </div>
            <br>
            <div>
                <strong>Subtotal:</strong> ₹${sale.subtotal.toFixed(2)}<br>
                <strong>Discount:</strong> ₹${sale.discount.toFixed(2)}<br>
                <strong>GST (${sale.gstRate}%):</strong> ₹${sale.tax.toFixed(2)}<br>
                <strong>Total:</strong> ₹${sale.total.toFixed(2)}<br>
                <strong>Payment:</strong> ${sale.paymentMethod}
            </div>
        </div>
    `;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
        <head><title>Invoice</title></head>
        <body>${invoiceHTML}</body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}

function printAllInvoices() {
    const shopHeader = shopSettings.name ? `
        <div style="text-align: center; margin-bottom: 10px;">
            ${shopSettings.logo ? `<img src="${shopSettings.logo}" style="max-width: 150px; max-height: 75px;"><br>` : ''}
            <div style="font-size: 20px; font-weight: bold;">${shopSettings.name}</div>
            ${shopSettings.address ? `<div>${shopSettings.address.replace(/\n/g, '<br>')}</div>` : ''}
            ${shopSettings.phone ? `<div>Phone: ${shopSettings.phone}</div>` : ''}
            ${shopSettings.email ? `<div>Email: ${shopSettings.email}</div>` : ''}
            ${shopSettings.gst ? `<div>GST: ${shopSettings.gst}</div>` : ''}
            ${shopSettings.website ? `<div>${shopSettings.website}</div>` : ''}
        </div>
        <hr style="border: none; border-top: 1px solid #000; margin: 10px 0;">
    ` : '';

    let allInvoicesHTML = `<html><head><title>All Invoices</title></head><body>${shopHeader}`;
    sales.forEach((sale, index) => {
        allInvoicesHTML += `
            <div style="page-break-after: always; font-family: Arial, sans-serif; max-width: 400px; margin: 0 auto;">
                <div style="text-align: center; font-size: 18px; font-weight: bold; margin-bottom: 10px;">Invoice #${sale.id}</div>
                <div>Date: ${new Date(sale.date).toLocaleString()}</div>
                <div>Customer: ${sale.customer.name}</div>
                <div>Status: ${sale.status}</div>
                <br>
                <div>
                    <strong>Items:</strong><br>
                    ${sale.items.map(item => `${item.name} x${item.quantity} - ₹${(item.price * item.quantity).toFixed(2)}<br>`).join('')}
                </div>
                <br>
                <div>
                    <strong>Subtotal:</strong> ₹${sale.subtotal.toFixed(2)}<br>
                    <strong>Discount:</strong> ₹${sale.discount.toFixed(2)}<br>
                    <strong>GST (${sale.gstRate}%):</strong> ₹${sale.tax.toFixed(2)}<br>
                    <strong>Total:</strong> ₹${sale.total.toFixed(2)}<br>
                    <strong>Payment:</strong> ${sale.paymentMethod}
                </div>
            </div>
        `;
    });
    allInvoicesHTML += '</body></html>';
    const printWindow = window.open('', '_blank');
    printWindow.document.write(allInvoicesHTML);
    printWindow.document.close();
    printWindow.print();
}

function generateReport() {
    const reportType = document.getElementById('reportType').value;
    const fromDate = document.getElementById('reportFromDate').value;
    const toDate = document.getElementById('reportToDate').value;

    let reportHTML = `<h3>${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report</h3>`;

    if (fromDate && toDate) {
        reportHTML += `<p>From: ${fromDate} To: ${toDate}</p>`;
    }

    const filteredSales = sales.filter(sale => {
        if (!fromDate || !toDate) return true;
        const saleDate = new Date(sale.date).toISOString().split('T')[0];
        return saleDate >= fromDate && saleDate <= toDate;
    });

    switch (reportType) {
        case 'sales':
            reportHTML += generateSalesReport(filteredSales);
            break;
        case 'inventory':
            reportHTML += generateInventoryReport();
            break;
        case 'customer':
            reportHTML += generateCustomerReport(filteredSales);
            break;
        case 'revenue':
            reportHTML += generateRevenueReport(filteredSales);
            break;
    }

    document.getElementById('reportContent').innerHTML = reportHTML;
}

function generateSalesReport(filteredSales) {
    let html = '<h4>Sales Summary</h4>';
    html += `<p>Total Sales: ${filteredSales.length}</p>`;
    html += `<p>Total Revenue: ₹${filteredSales.reduce((sum, sale) => sum + sale.total, 0).toFixed(2)}</p>`;
    html += `<p>Total Discount: ₹${filteredSales.reduce((sum, sale) => sum + sale.discount, 0).toFixed(2)}</p>`;
    html += `<p>Total Tax: ₹${filteredSales.reduce((sum, sale) => sum + sale.tax, 0).toFixed(2)}</p>`;

    html += '<h4>Top Selling Items</h4><table><thead><tr><th>Item</th><th>Quantity Sold</th><th>Revenue</th></tr></thead><tbody>';
    const itemStats = {};
    filteredSales.forEach(sale => {
        sale.items.forEach(item => {
            if (!itemStats[item.name]) {
                itemStats[item.name] = { quantity: 0, revenue: 0 };
            }
            itemStats[item.name].quantity += item.quantity;
            itemStats[item.name].revenue += item.price * item.quantity;
        });
    });
    Object.entries(itemStats).sort((a, b) => b[1].quantity - a[1].quantity).forEach(([name, stats]) => {
        html += `<tr><td>${name}</td><td>${stats.quantity}</td><td>₹${stats.revenue.toFixed(2)}</td></tr>`;
    });
    html += '</tbody></table>';

    return html;
}

function generateInventoryReport() {
    let html = '<h4>Inventory Summary</h4>';
    html += `<p>Total Items: ${items.length}</p>`;
    html += `<p>Total Stock Value: ₹${items.reduce((sum, item) => sum + (item.costPrice * item.quantity), 0).toFixed(2)}</p>`;
    html += `<p>Total Selling Value: ₹${items.reduce((sum, item) => sum + (item.sellingPrice * item.quantity), 0).toFixed(2)}</p>`;
    html += `<p>Low Stock Items: ${items.filter(item => item.quantity <= item.minStock).length}</p>`;

    html += '<h4>Low Stock Items</h4><table><thead><tr><th>Name</th><th>Current Stock</th><th>Min Stock</th></tr></thead><tbody>';
    items.filter(item => item.quantity <= item.minStock).forEach(item => {
        html += `<tr><td>${item.name}</td><td>${item.quantity}</td><td>${item.minStock}</td></tr>`;
    });
    html += '</tbody></table>';

    return html;
}

function generateCustomerReport(filteredSales) {
    let html = '<h4>Customer Summary</h4>';
    const customerStats = {};
    filteredSales.forEach(sale => {
        const customerName = sale.customer.name;
        if (!customerStats[customerName]) {
            customerStats[customerName] = { purchases: 0, totalSpent: 0 };
        }
        customerStats[customerName].purchases++;
        customerStats[customerName].totalSpent += sale.total;
    });

    html += '<table><thead><tr><th>Customer</th><th>Purchases</th><th>Total Spent</th></tr></thead><tbody>';
    Object.entries(customerStats).sort((a, b) => b[1].totalSpent - a[1].totalSpent).forEach(([name, stats]) => {
        html += `<tr><td>${name}</td><td>${stats.purchases}</td><td>₹${stats.totalSpent.toFixed(2)}</td></tr>`;
    });
    html += '</tbody></table>';

    return html;
}

function generateRevenueReport(filteredSales) {
    let html = '<h4>Revenue Summary</h4>';
    const totalRevenue = filteredSales.reduce((sum, sale) => sum + sale.total, 0);
    const totalCost = filteredSales.reduce((sum, sale) => {
        return sum + sale.items.reduce((itemSum, item) => {
            const itemData = items.find(i => i.sku === item.sku);
            return itemSum + (itemData ? itemData.costPrice * item.quantity : 0);
        }, 0);
    }, 0);
    const profit = totalRevenue - totalCost;

    html += `<p>Total Revenue: ₹${totalRevenue.toFixed(2)}</p>`;
    html += `<p>Total Cost: ₹${totalCost.toFixed(2)}</p>`;
    html += `<p>Profit: ₹${profit.toFixed(2)}</p>`;
    html += `<p>Profit Margin: ${totalRevenue > 0 ? ((profit / totalRevenue) * 100).toFixed(2) : 0}%</p>`;

    // Daily revenue
    html += '<h4>Daily Revenue</h4><table><thead><tr><th>Date</th><th>Revenue</th><th>Sales Count</th></tr></thead><tbody>';
    const dailyStats = {};
    filteredSales.forEach(sale => {
        const date = new Date(sale.date).toISOString().split('T')[0];
        if (!dailyStats[date]) {
            dailyStats[date] = { revenue: 0, count: 0 };
        }
        dailyStats[date].revenue += sale.total;
        dailyStats[date].count++;
    });
    Object.entries(dailyStats).sort((a, b) => a[0].localeCompare(b[0])).forEach(([date, stats]) => {
        html += `<tr><td>${date}</td><td>₹${stats.revenue.toFixed(2)}</td><td>${stats.count}</td></tr>`;
    });
    html += '</tbody></table>';

    return html;
}

function exportReport() {
    const reportContent = document.getElementById('reportContent').innerHTML;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
        <head><title>Report</title><style>body { font-family: Arial, sans-serif; }</style></head>
        <body>${reportContent}</body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}

function showSettings() {
    document.getElementById('shopName').value = shopSettings.name || '';
    document.getElementById('shopAddress').value = shopSettings.address || '';
    document.getElementById('shopPhone').value = shopSettings.phone || '';
    document.getElementById('shopEmail').value = shopSettings.email || '';
    document.getElementById('shopGST').value = shopSettings.gst || '';
    document.getElementById('shopWebsite').value = shopSettings.website || '';
    document.getElementById('shopLogo').value = shopSettings.logo || '';
    document.getElementById('settingsModal').style.display = 'block';
}

function changeInvoiceStatus(index) {
    const sale = sales[index];
    const newStatus = prompt('Enter new status (paid/pending/cancelled):', sale.status);
    if (newStatus && ['paid', 'pending', 'cancelled'].includes(newStatus)) {
        sales[index].status = newStatus;
        saveData();
        renderInvoiceTable();
    }
}

// Category filter
function updateCategoryFilter() {
    const categoryFilter = document.getElementById('categoryFilter');
    const categories = [...new Set(items.map(item => item.category))];
    categoryFilter.innerHTML = '<option value="">All Categories</option>';
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        categoryFilter.appendChild(option);
    });
}

// Search and filter
function filterItems() {
    const query = document.getElementById('itemSearch').value.toLowerCase();
    const filteredItems = items.filter(item => item.name.toLowerCase().includes(query));
    renderFilteredItemGrid(filteredItems);
}

function filterInventory() {
    const query = document.getElementById('inventorySearch').value.toLowerCase();
    const category = document.getElementById('categoryFilter').value;
    let filteredItems = items.filter(item => item.name.toLowerCase().includes(query));
    if (category) {
        filteredItems = filteredItems.filter(item => item.category === category);
    }
    renderFilteredInventoryTable(filteredItems);
}

function renderFilteredItemGrid(filteredItems) {
    itemGrid.innerHTML = '';
    filteredItems.forEach((item) => {
        const itemCard = document.createElement('div');
        itemCard.className = 'item-card';
        itemCard.innerHTML = `
            <h4>${item.name}</h4>
            <p>₹${item.sellingPrice.toFixed(2)}</p>
            <p>Stock: ${item.quantity}</p>
            <button onclick="addToCart(${item.id})" ${item.quantity === 0 ? 'disabled' : ''}>Add to Cart</button>
        `;
        itemGrid.appendChild(itemCard);
    });
}

function filterInventory() {
    const query = document.getElementById('inventorySearch').value.toLowerCase();
    const filteredItems = items.filter(item => item.name.toLowerCase().includes(query));
    renderFilteredInventoryTable(filteredItems);
}

function renderFilteredInventoryTable(filteredItems) {
    inventoryTable.innerHTML = '';
    filteredItems.forEach((item) => {
        const status = item.quantity <= item.minStock ? 'Low Stock' : 'In Stock';
        const statusClass = status === 'Low Stock' ? 'low-stock' : 'in-stock';
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.name}</td>
            <td>${item.sku}</td>
            <td>${item.barcode || 'N/A'}</td>
            <td>${item.hsn || 'N/A'}</td>
            <td>${item.category}</td>
            <td>₹${item.costPrice.toFixed(2)}</td>
            <td>₹${item.sellingPrice.toFixed(2)}</td>
            <td>₹${item.mrp.toFixed(2)}</td>
            <td>${item.quantity}</td>
            <td>${item.minStock}</td>
            <td>${item.supplier || 'N/A'}</td>
            <td class="${statusClass}">${status}</td>
            <td>
                <button onclick="editItem(${item.id})">Edit</button>
                <button class="danger" onclick="deleteItem(${item.id})">Delete</button>
            </td>
        `;
        inventoryTable.appendChild(row);
    });
}

// Export to CSV
function exportInventory() {
    let csv = 'Name,SKU,Barcode,HSN,Category,Cost Price,Selling Price,MRP,Quantity,Min Stock,Supplier,Status\n';
    items.forEach(item => {
        const status = item.quantity <= item.minStock ? 'Low Stock' : 'In Stock';
        csv += `"${item.name}","${item.sku}","${item.barcode || ''}","${item.hsn || ''}","${item.category}",${item.costPrice},${item.sellingPrice},${item.mrp},${item.quantity},${item.minStock},"${item.supplier || ''}","${status}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', 'inventory.csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// Bulk Actions
function showBulkActions() {
    document.getElementById('bulkActionsModal').style.display = 'block';
}

function bulkDelete() {
    const lowStockItems = items.filter(item => item.minStock && item.quantity <= item.minStock);
    if (lowStockItems.length === 0) {
        alert('No low stock items to delete.');
        return;
    }
    if (confirm(`Delete ${lowStockItems.length} low stock items?`)) {
        lowStockItems.forEach(item => {
            const index = items.indexOf(item);
            items.splice(index, 1);
        });
        saveData();
        renderInventoryTable();
        renderItemGrid();
        updateDashboard();
        updateInventoryStats();
        updateCategoryFilter();
        closeModal();
    }
}

function bulkUpdateCategory() {
    const newCategory = prompt('Enter new category for all items:');
    if (newCategory) {
        items.forEach(item => {
            item.category = newCategory;
            item.lastUpdated = new Date().toISOString();
        });
        saveData();
        renderInventoryTable();
        updateInventoryStats();
        updateCategoryFilter();
        closeModal();
    }
}