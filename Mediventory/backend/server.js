require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const dns = require("dns");

const app = express();
const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET || "replace-this-secret";
const PUBLIC_DIR = path.join(__dirname, "..", "frontend");

const ROLES = {
  Admin: ["*"],
  Pharmacist: ["read", "sale:create", "return:create"],
  "Inventory Manager": ["read", "inventory:write", "transfer:create"],
  "Procurement Manager": ["read", "supplier:write", "purchase:write"],
  "Viewer/Auditor": ["read"]
};

if (!MONGODB_URI) {
  console.error("MONGODB_URI is missing. Add it to .env before starting the server.");
  process.exit(1);
}

dns.setServers((process.env.DNS_SERVERS || "8.8.8.8,1.1.1.1").split(",").map(server => server.trim()));
mongoose.set("strictQuery", true);

const baseOptions = {
  timestamps: true,
  versionKey: false,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
};

const User = mongoose.model("User", new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  role: { type: String, enum: Object.keys(ROLES), required: true },
  passwordHash: { type: String, required: true },
  active: { type: Boolean, default: true }
}, baseOptions));

const Category = mongoose.model("Category", new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true }
}, baseOptions));

const Location = mongoose.model("Location", new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  type: { type: String, enum: ["Branch", "Warehouse", "Cold Storage"], default: "Branch" }
}, baseOptions));

const Supplier = mongoose.model("Supplier", new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  contactPerson: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  email: { type: String, trim: true },
  gstin: { type: String, trim: true },
  rating: { type: Number, default: 0 },
  active: { type: Boolean, default: true }
}, baseOptions));

const Medicine = mongoose.model("Medicine", new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  genericName: { type: String, required: true, trim: true },
  brand: { type: String, trim: true },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
  dosageForm: { type: String, required: true, trim: true },
  strength: { type: String, required: true, trim: true },
  manufacturer: { type: String, trim: true },
  mrp: { type: Number, required: true, min: 0 },
  purchasePrice: { type: Number, required: true, min: 0 },
  reorderLevel: { type: Number, default: 0, min: 0 },
  active: { type: Boolean, default: true }
}, baseOptions));

Medicine.schema.index({ name: 1, strength: 1 }, { unique: true });

const Inventory = mongoose.model("Inventory", new mongoose.Schema({
  medicineId: { type: mongoose.Schema.Types.ObjectId, ref: "Medicine", required: true },
  batchNumber: { type: String, required: true, trim: true },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: "Location", required: true },
  quantity: { type: Number, required: true, min: 0 },
  expiryDate: { type: Date, required: true },
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier" },
  receivedAt: { type: Date, default: Date.now }
}, baseOptions));

Inventory.schema.index({ batchNumber: 1, locationId: 1 }, { unique: true });

const PurchaseOrder = mongoose.model("PurchaseOrder", new mongoose.Schema({
  poNumber: { type: String, required: true, unique: true },
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", required: true },
  status: { type: String, enum: ["Created", "Approved", "Received", "Cancelled"], default: "Created" },
  items: [{
    medicineId: { type: mongoose.Schema.Types.ObjectId, ref: "Medicine", required: true },
    medicineName: String,
    quantity: { type: Number, required: true, min: 1 },
    unitCost: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 }
  }],
  totalAmount: { type: Number, default: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, baseOptions));

const Sale = mongoose.model("Sale", new mongoose.Schema({
  invoiceNumber: { type: String, required: true, unique: true },
  customerName: { type: String, required: true },
  customerType: { type: String, required: true },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: "Location", required: true },
  items: [{
    medicineId: { type: mongoose.Schema.Types.ObjectId, ref: "Medicine", required: true },
    medicineName: String,
    batchNumber: String,
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 }
  }],
  totalAmount: { type: Number, required: true, min: 0 },
  processedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, baseOptions));

const AuditLog = mongoose.model("AuditLog", new mongoose.Schema({
  actor: { type: String, default: "system" },
  action: { type: String, required: true },
  details: { type: String, default: "" }
}, baseOptions));

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));
app.use(express.static(PUBLIC_DIR));

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    uptime: process.uptime()
  });
});

function publicId(doc) {
  if (!doc) return doc;
  const obj = typeof doc.toObject === "function" ? doc.toObject() : doc;
  return { ...obj, id: String(obj._id), _id: undefined };
}

function publicRows(rows) {
  return rows.map(publicId);
}

function required(body, fields) {
  const missing = fields.filter(field => body[field] === undefined || body[field] === "");
  return missing.length ? `Missing required fields: ${missing.join(", ")}` : null;
}

function signToken(user) {
  return jwt.sign(
    { sub: String(user._id), name: user.name, role: user.role },
    JWT_SECRET,
    { expiresIn: "8h" }
  );
}

function can(user, permission) {
  const permissions = ROLES[user?.role] || [];
  return permissions.includes("*") || permissions.includes(permission) || permissions.includes("read");
}

async function auth(req, res, next) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Authentication required" });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

function requirePermission(permission) {
  return (req, res, next) => {
    if (!can(req.user, permission)) return res.status(403).json({ error: "Access denied" });
    next();
  };
}

async function audit(actor, action, details) {
  await AuditLog.create({
    actor: actor?.name || actor?.email || actor?.sub || "system",
    action,
    details
  });
}

async function totalStock(medicineId) {
  const rows = await Inventory.aggregate([
    { $match: { medicineId: new mongoose.Types.ObjectId(medicineId) } },
    { $group: { _id: "$medicineId", quantity: { $sum: "$quantity" } } }
  ]);
  return rows[0]?.quantity || 0;
}

async function inventoryRows() {
  return Inventory.find()
    .sort({ expiryDate: 1 })
    .populate("medicineId")
    .populate("locationId")
    .populate("supplierId")
    .lean()
    .then(rows => rows.map(row => ({
      ...row,
      id: String(row._id),
      medicine: row.medicineId ? { ...row.medicineId, id: String(row.medicineId._id) } : null,
      location: row.locationId ? { ...row.locationId, id: String(row.locationId._id) } : null,
      supplier: row.supplierId ? { ...row.supplierId, id: String(row.supplierId._id) } : null,
      medicineId: row.medicineId?._id ? String(row.medicineId._id) : String(row.medicineId),
      locationId: row.locationId?._id ? String(row.locationId._id) : String(row.locationId),
      supplierId: row.supplierId?._id ? String(row.supplierId._id) : String(row.supplierId || "")
    })));
}

async function getAlerts() {
  const today = new Date();
  const sixtyDays = new Date(today.getTime() + 60 * 86400000);
  const medicines = await Medicine.find().populate("categoryId").lean();
  const inventory = await inventoryRows();
  const quantities = await Inventory.aggregate([{ $group: { _id: "$medicineId", quantity: { $sum: "$quantity" } } }]);
  const quantityMap = new Map(quantities.map(row => [String(row._id), row.quantity]));
  return {
    lowStock: medicines
      .map(medicine => ({ medicine: { ...medicine, id: String(medicine._id) }, quantity: quantityMap.get(String(medicine._id)) || 0 }))
      .filter(row => row.quantity <= Number(row.medicine.reorderLevel || 0)),
    nearExpiry: inventory.filter(row => new Date(row.expiryDate) >= today && new Date(row.expiryDate) <= sixtyDays),
    expired: inventory.filter(row => new Date(row.expiryDate) < today)
  };
}

async function dashboardSummary() {
  const [medicines, batches, stockUnits, valuation, revenue, alertData] = await Promise.all([
    Medicine.countDocuments(),
    Inventory.countDocuments(),
    Inventory.aggregate([{ $group: { _id: null, total: { $sum: "$quantity" } } }]),
    Inventory.aggregate([
      { $lookup: { from: "medicines", localField: "medicineId", foreignField: "_id", as: "medicine" } },
      { $unwind: "$medicine" },
      { $group: { _id: null, total: { $sum: { $multiply: ["$quantity", "$medicine.purchasePrice"] } } } }
    ]),
    Sale.aggregate([{ $group: { _id: null, total: { $sum: "$totalAmount" } } }]),
    getAlerts()
  ]);

  return {
    medicines,
    batches,
    totalUnits: stockUnits[0]?.total || 0,
    lowStockCount: alertData.lowStock.length,
    nearExpiryCount: alertData.nearExpiry.length,
    expiredCount: alertData.expired.length,
    stockValue: valuation[0]?.total || 0,
    revenue: revenue[0]?.total || 0
  };
}

async function seedDatabase() {
  await Promise.all([
    User.syncIndexes(),
    Category.syncIndexes(),
    Location.syncIndexes(),
    Medicine.syncIndexes(),
    Inventory.syncIndexes()
  ]);

  if (await User.countDocuments()) return;

  const [adminHash, pharmacistHash] = await Promise.all([
    bcrypt.hash("admin123", 12),
    bcrypt.hash("pharma123", 12)
  ]);

  const [antibiotic, analgesic, antacid] = await Category.create([
    { name: "Antibiotic" },
    { name: "Analgesic" },
    { name: "Antacid" }
  ]);

  const [mainLocation, coldStorage] = await Location.create([
    { name: "Main Pharmacy", type: "Branch" },
    { name: "Cold Storage", type: "Cold Storage" }
  ]);

  const supplier = await Supplier.create({
    name: "HealthPlus Distributors",
    contactPerson: "Nisha Rao",
    phone: "9876543210",
    email: "orders@healthplus.example",
    gstin: "29ABCDE1234F1Z5",
    rating: 4.7
  });

  const [admin] = await User.create([
    { name: "Admin User", email: "admin@mims.local", role: "Admin", passwordHash: adminHash },
    { name: "Pharmacist", email: "pharmacist@mims.local", role: "Pharmacist", passwordHash: pharmacistHash }
  ]);

  const [amox, para, omep] = await Medicine.create([
    {
      name: "Amoxicillin",
      genericName: "Amoxicillin",
      brand: "MoxCare",
      categoryId: antibiotic._id,
      dosageForm: "Capsule",
      strength: "500 mg",
      manufacturer: "Care Labs",
      mrp: 128,
      purchasePrice: 84,
      reorderLevel: 40
    },
    {
      name: "Paracetamol",
      genericName: "Acetaminophen",
      brand: "FeverNil",
      categoryId: analgesic._id,
      dosageForm: "Tablet",
      strength: "650 mg",
      manufacturer: "WellCure",
      mrp: 32,
      purchasePrice: 18,
      reorderLevel: 100
    },
    {
      name: "Omeprazole",
      genericName: "Omeprazole",
      brand: "OmeFast",
      categoryId: antacid._id,
      dosageForm: "Capsule",
      strength: "20 mg",
      manufacturer: "MediCore",
      mrp: 92,
      purchasePrice: 55,
      reorderLevel: 30
    }
  ]);

  await Inventory.create([
    { medicineId: amox._id, batchNumber: "AMX2409A", locationId: mainLocation._id, quantity: 75, expiryDate: "2026-08-30", supplierId: supplier._id, receivedAt: "2026-04-16" },
    { medicineId: para._id, batchNumber: "PAR2601B", locationId: mainLocation._id, quantity: 420, expiryDate: "2027-01-15", supplierId: supplier._id, receivedAt: "2026-04-19" },
    { medicineId: omep._id, batchNumber: "OMP2406C", locationId: coldStorage._id, quantity: 18, expiryDate: "2026-06-05", supplierId: supplier._id, receivedAt: "2026-03-21" }
  ]);

  await audit(admin, "seed:data", "Initial MongoDB demo data created");
}

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const user = await User.findOne({ email: String(req.body.email || "").toLowerCase(), active: true });
    if (!user || !(await bcrypt.compare(req.body.password || "", user.passwordHash))) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    await audit(user, "auth:login", "User logged in");
    const safeUser = publicId(user);
    delete safeUser.passwordHash;
    return res.json({ token: signToken(user), user: safeUser });
  } catch (error) {
    next(error);
  }
});

app.use("/api", auth);

app.get("/api/meta", async (req, res, next) => {
  try {
    const [categories, locations] = await Promise.all([Category.find().sort("name"), Location.find().sort("name")]);
    res.json({ categories: publicRows(categories), locations: publicRows(locations), roles: Object.keys(ROLES) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/dashboard", async (req, res, next) => {
  try {
    res.json({ summary: await dashboardSummary(), alerts: await getAlerts() });
  } catch (error) {
    next(error);
  }
});

app.get("/api/alerts", async (req, res, next) => {
  try {
    res.json(await getAlerts());
  } catch (error) {
    next(error);
  }
});

app.get("/api/audit", async (req, res, next) => {
  try {
    const rows = await AuditLog.find().sort({ createdAt: -1 }).limit(100);
    res.json(publicRows(rows));
  } catch (error) {
    next(error);
  }
});

app.get("/api/medicines", async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();
    const filter = q ? {
      $or: [
        { name: new RegExp(q, "i") },
        { genericName: new RegExp(q, "i") },
        { brand: new RegExp(q, "i") },
        { manufacturer: new RegExp(q, "i") }
      ]
    } : {};
    const medicines = await Medicine.find(filter).populate("categoryId").sort("name").lean();
    const stock = await Inventory.aggregate([{ $group: { _id: "$medicineId", quantity: { $sum: "$quantity" } } }]);
    const stockMap = new Map(stock.map(row => [String(row._id), row.quantity]));
    res.json(medicines.map(medicine => ({
      ...medicine,
      id: String(medicine._id),
      categoryId: String(medicine.categoryId?._id || medicine.categoryId),
      category: medicine.categoryId?.name || "-",
      stock: stockMap.get(String(medicine._id)) || 0
    })));
  } catch (error) {
    next(error);
  }
});

app.post("/api/medicines", requirePermission("inventory:write"), async (req, res, next) => {
  try {
    const error = required(req.body, ["name", "genericName", "categoryId", "dosageForm", "strength", "mrp", "purchasePrice"]);
    if (error) return res.status(400).json({ error });
    const medicine = await Medicine.create({ active: true, reorderLevel: 0, ...req.body });
    await audit(req.user, "medicine:create", medicine.name);
    res.status(201).json(publicId(medicine));
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: "Duplicate medicine entry" });
    next(error);
  }
});

app.get("/api/inventory", async (req, res, next) => {
  try {
    res.json(await inventoryRows());
  } catch (error) {
    next(error);
  }
});

app.post("/api/inventory", requirePermission("inventory:write"), async (req, res, next) => {
  try {
    const error = required(req.body, ["medicineId", "batchNumber", "locationId", "quantity", "expiryDate"]);
    if (error) return res.status(400).json({ error });
    if (Number(req.body.quantity) < 0) return res.status(400).json({ error: "Negative stock is not allowed" });
    const batch = await Inventory.create({ ...req.body, quantity: Number(req.body.quantity) });
    await audit(req.user, "inventory:add", `${batch.batchNumber} received`);
    res.status(201).json(publicId(batch));
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: "Duplicate batch number for this location" });
    next(error);
  }
});

app.post("/api/inventory/adjust", requirePermission("inventory:write"), async (req, res, next) => {
  try {
    const batch = await Inventory.findById(req.body.inventoryId);
    if (!batch) return res.status(404).json({ error: "Inventory batch not found" });
    const nextQuantity = batch.quantity + Number(req.body.delta || 0);
    if (nextQuantity < 0) return res.status(400).json({ error: "Negative stock is not allowed" });
    batch.quantity = nextQuantity;
    await batch.save();
    await audit(req.user, "inventory:adjust", `${batch.batchNumber} changed by ${req.body.delta}`);
    res.json(publicId(batch));
  } catch (error) {
    next(error);
  }
});

app.post("/api/inventory/transfer", requirePermission("transfer:create"), async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const source = await Inventory.findById(req.body.inventoryId).session(session);
      if (!source) throw Object.assign(new Error("Source batch not found"), { status: 404 });
      const quantity = Number(req.body.quantity);
      if (quantity <= 0 || source.quantity < quantity) throw Object.assign(new Error("Invalid transfer quantity"), { status: 400 });
      source.quantity -= quantity;
      await source.save({ session });
      await Inventory.create([{
        medicineId: source.medicineId,
        batchNumber: `${source.batchNumber}-T${Date.now()}`,
        locationId: req.body.toLocationId,
        quantity,
        expiryDate: source.expiryDate,
        supplierId: source.supplierId,
        receivedAt: new Date()
      }], { session });
      await audit(req.user, "inventory:transfer", `${quantity} units of ${source.batchNumber} transferred`);
    });
    res.status(201).json({ ok: true });
  } catch (error) {
    next(error);
  } finally {
    await session.endSession();
  }
});

app.get("/api/suppliers", async (req, res, next) => {
  try {
    res.json(publicRows(await Supplier.find().sort("name")));
  } catch (error) {
    next(error);
  }
});

app.post("/api/suppliers", requirePermission("supplier:write"), async (req, res, next) => {
  try {
    const error = required(req.body, ["name", "contactPerson", "phone"]);
    if (error) return res.status(400).json({ error });
    const supplier = await Supplier.create({ active: true, rating: 0, ...req.body });
    await audit(req.user, "supplier:create", supplier.name);
    res.status(201).json(publicId(supplier));
  } catch (error) {
    next(error);
  }
});

app.get("/api/purchases", async (req, res, next) => {
  try {
    res.json(publicRows(await PurchaseOrder.find().sort({ createdAt: -1 }).populate("supplierId")));
  } catch (error) {
    next(error);
  }
});

app.post("/api/purchases", requirePermission("purchase:write"), async (req, res, next) => {
  try {
    const error = required(req.body, ["supplierId", "items"]);
    if (error) return res.status(400).json({ error });
    const items = [];
    for (const item of req.body.items || []) {
      const medicine = await Medicine.findById(item.medicineId);
      if (!medicine) return res.status(404).json({ error: `Medicine not found: ${item.medicineId}` });
      const quantity = Number(item.quantity);
      const unitCost = Number(item.unitCost || medicine.purchasePrice || 0);
      items.push({ medicineId: medicine._id, medicineName: medicine.name, quantity, unitCost, amount: quantity * unitCost });
    }
    const order = await PurchaseOrder.create({
      poNumber: `PO-${Date.now()}`,
      supplierId: req.body.supplierId,
      items,
      totalAmount: items.reduce((sum, item) => sum + item.amount, 0),
      createdBy: req.user.sub
    });
    await audit(req.user, "purchase:create", order.poNumber);
    res.status(201).json(publicId(order));
  } catch (error) {
    next(error);
  }
});

app.post("/api/purchases/:id/receive", requirePermission("purchase:write"), async (req, res, next) => {
  try {
    const order = await PurchaseOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ error: "Purchase order not found" });
    for (const item of req.body.batches || []) {
      await Inventory.create({
        medicineId: item.medicineId,
        batchNumber: item.batchNumber,
        locationId: item.locationId,
        quantity: Number(item.quantity),
        expiryDate: item.expiryDate,
        supplierId: order.supplierId,
        receivedAt: new Date()
      });
    }
    order.status = "Received";
    await order.save();
    await audit(req.user, "purchase:receive", order.poNumber);
    res.json(publicId(order));
  } catch (error) {
    next(error);
  }
});

app.get("/api/sales", async (req, res, next) => {
  try {
    res.json(publicRows(await Sale.find().sort({ createdAt: -1 }).limit(100)));
  } catch (error) {
    next(error);
  }
});

app.post("/api/sales", requirePermission("sale:create"), async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    let createdSale;
    await session.withTransaction(async () => {
      const error = required(req.body, ["customerName", "customerType", "locationId", "items"]);
      if (error) throw Object.assign(new Error(error), { status: 400 });
      const saleItems = [];
      for (const item of req.body.items || []) {
        const medicine = await Medicine.findById(item.medicineId).session(session);
        if (!medicine) throw Object.assign(new Error(`Medicine not found: ${item.medicineId}`), { status: 404 });
        let remaining = Number(item.quantity);
        if (!Number.isFinite(remaining) || remaining <= 0) throw Object.assign(new Error("Quantity must be greater than zero"), { status: 400 });
        const batches = await Inventory.find({
          medicineId: medicine._id,
          locationId: req.body.locationId,
          quantity: { $gt: 0 },
          expiryDate: { $gte: new Date() }
        }).sort({ expiryDate: 1 }).session(session);
        const available = batches.reduce((sum, batch) => sum + batch.quantity, 0);
        if (available < remaining) throw Object.assign(new Error(`Insufficient non-expired stock for ${medicine.name}`), { status: 400 });
        for (const batch of batches) {
          if (remaining === 0) break;
          const used = Math.min(batch.quantity, remaining);
          batch.quantity -= used;
          remaining -= used;
          await batch.save({ session });
          saleItems.push({
            medicineId: medicine._id,
            medicineName: medicine.name,
            batchNumber: batch.batchNumber,
            quantity: used,
            unitPrice: medicine.mrp,
            amount: used * medicine.mrp
          });
        }
      }
      createdSale = await Sale.create([{
        invoiceNumber: `INV-${Date.now()}`,
        customerName: req.body.customerName,
        customerType: req.body.customerType,
        locationId: req.body.locationId,
        items: saleItems,
        totalAmount: saleItems.reduce((sum, item) => sum + item.amount, 0),
        processedBy: req.user.sub
      }], { session });
      await audit(req.user, "sale:create", `Invoice ${createdSale[0].invoiceNumber} generated`);
    });
    res.status(201).json(publicId(createdSale[0]));
  } catch (error) {
    next(error);
  } finally {
    await session.endSession();
  }
});

app.get("/api/reports", async (req, res, next) => {
  try {
    const [inventory, sales, purchases, alertData, summary] = await Promise.all([
      inventoryRows(),
      Sale.find().sort({ createdAt: -1 }).lean(),
      PurchaseOrder.find().sort({ createdAt: -1 }).lean(),
      getAlerts(),
      dashboardSummary()
    ]);
    res.json({
      generatedAt: new Date().toISOString(),
      inventory,
      sales: sales.map(row => ({ ...row, id: String(row._id) })),
      purchases: purchases.map(row => ({ ...row, id: String(row._id) })),
      alerts: alertData,
      valuation: summary.stockValue
    });
  } catch (error) {
    next(error);
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.use((error, req, res, next) => {
  const status = error.status || (error.name === "ValidationError" ? 400 : 500);
  const duplicate = error.code === 11000;
  res.status(duplicate ? 409 : status).json({
    error: duplicate ? "Duplicate record" : error.message || "Server error"
  });
});

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB");
  await seedDatabase();

  if (process.argv.includes("--seed-only")) {
    console.log("Seed complete");
    await mongoose.disconnect();
    return;
  }

  app.listen(PORT, () => {
    console.log(`Mediventory running at http://localhost:${PORT}`);
    console.log("Demo logins: admin@mims.local/admin123, pharmacist@mims.local/pharma123");
  });
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
