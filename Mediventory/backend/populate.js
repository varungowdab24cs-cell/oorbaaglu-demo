require("dotenv").config();

const dns = require("dns");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

dns.setServers((process.env.DNS_SERVERS || "8.8.8.8,1.1.1.1").split(",").map(server => server.trim()));

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("MONGODB_URI is missing. Add it to .env before populating the database.");
  process.exit(1);
}

const baseOptions = { timestamps: true, versionKey: false };

const User = mongoose.model("User", new mongoose.Schema({
  name: String,
  email: { type: String, unique: true, lowercase: true },
  role: String,
  passwordHash: String,
  active: Boolean
}, baseOptions));

const Category = mongoose.model("Category", new mongoose.Schema({ name: { type: String, unique: true } }, baseOptions));
const Location = mongoose.model("Location", new mongoose.Schema({ name: { type: String, unique: true }, type: String }, baseOptions));
const Supplier = mongoose.model("Supplier", new mongoose.Schema({
  name: String,
  contactPerson: String,
  phone: String,
  email: String,
  gstin: String,
  rating: Number,
  active: Boolean
}, baseOptions));

const Medicine = mongoose.model("Medicine", new mongoose.Schema({
  name: String,
  genericName: String,
  brand: String,
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
  dosageForm: String,
  strength: String,
  manufacturer: String,
  mrp: Number,
  purchasePrice: Number,
  reorderLevel: Number,
  active: Boolean
}, baseOptions));

const Inventory = mongoose.model("Inventory", new mongoose.Schema({
  medicineId: { type: mongoose.Schema.Types.ObjectId, ref: "Medicine" },
  batchNumber: String,
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: "Location" },
  quantity: Number,
  expiryDate: Date,
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier" },
  receivedAt: Date
}, baseOptions));

const PurchaseOrder = mongoose.model("PurchaseOrder", new mongoose.Schema({
  poNumber: { type: String, unique: true },
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier" },
  status: String,
  items: [{
    medicineId: { type: mongoose.Schema.Types.ObjectId, ref: "Medicine" },
    medicineName: String,
    quantity: Number,
    unitCost: Number,
    amount: Number
  }],
  totalAmount: Number,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, baseOptions));

const Sale = mongoose.model("Sale", new mongoose.Schema({
  invoiceNumber: { type: String, unique: true },
  customerName: String,
  customerType: String,
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: "Location" },
  items: [{
    medicineId: { type: mongoose.Schema.Types.ObjectId, ref: "Medicine" },
    medicineName: String,
    batchNumber: String,
    quantity: Number,
    unitPrice: Number,
    amount: Number
  }],
  totalAmount: Number,
  processedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, baseOptions));

const AuditLog = mongoose.model("AuditLog", new mongoose.Schema({
  actor: String,
  action: String,
  details: String
}, baseOptions));

async function upsert(Model, filter, data) {
  return Model.findOneAndUpdate(filter, { $set: data }, { new: true, upsert: true, setDefaultsOnInsert: true });
}

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB Atlas");

  const passwordHash = await bcrypt.hash("admin123", 12);
  const pharmaHash = await bcrypt.hash("pharma123", 12);
  const managerHash = await bcrypt.hash("manager123", 12);

  const users = {};
  for (const user of [
    { name: "Admin User", email: "admin@mims.local", role: "Admin", passwordHash, active: true },
    { name: "Pharmacist", email: "pharmacist@mims.local", role: "Pharmacist", passwordHash: pharmaHash, active: true },
    { name: "Inventory Manager", email: "inventory@mims.local", role: "Inventory Manager", passwordHash: managerHash, active: true },
    { name: "Procurement Manager", email: "procurement@mims.local", role: "Procurement Manager", passwordHash: managerHash, active: true },
    { name: "Auditor", email: "auditor@mims.local", role: "Viewer/Auditor", passwordHash: managerHash, active: true }
  ]) {
    users[user.email] = await upsert(User, { email: user.email }, user);
  }

  const categories = {};
  for (const name of ["Antibiotic", "Analgesic", "Antacid", "Antihistamine", "Antidiabetic", "Cardiac", "Vitamin", "Respiratory"]) {
    categories[name] = await upsert(Category, { name }, { name });
  }

  const locations = {};
  for (const location of [
    { name: "Main Pharmacy", type: "Branch" },
    { name: "Cold Storage", type: "Cold Storage" },
    { name: "Emergency Ward Store", type: "Branch" },
    { name: "Central Warehouse", type: "Warehouse" }
  ]) {
    locations[location.name] = await upsert(Location, { name: location.name }, location);
  }

  const suppliers = {};
  for (const supplier of [
    { name: "HealthPlus Distributors", contactPerson: "Nisha Rao", phone: "9876543210", email: "orders@healthplus.example", gstin: "29ABCDE1234F1Z5", rating: 4.7, active: true },
    { name: "MediCore Wholesale", contactPerson: "Arjun Menon", phone: "9845011223", email: "supply@medicore.example", gstin: "29AAHCM7788B1Z2", rating: 4.5, active: true },
    { name: "CureLine Pharma Supply", contactPerson: "Farah Khan", phone: "9900123456", email: "dispatch@cureline.example", gstin: "29AABCU9603R1Z8", rating: 4.2, active: true },
    { name: "LifeBridge Medicals", contactPerson: "Rohit Sharma", phone: "9988776655", email: "po@lifebridge.example", gstin: "29AACCL4567Q1Z3", rating: 4.8, active: true }
  ]) {
    suppliers[supplier.name] = await upsert(Supplier, { name: supplier.name }, supplier);
  }

  const medicineSeed = [
    ["Amoxicillin", "Amoxicillin", "MoxCare", "Antibiotic", "Capsule", "500 mg", "Care Labs", 128, 84, 40],
    ["Paracetamol", "Acetaminophen", "FeverNil", "Analgesic", "Tablet", "650 mg", "WellCure", 32, 18, 100],
    ["Omeprazole", "Omeprazole", "OmeFast", "Antacid", "Capsule", "20 mg", "MediCore", 92, 55, 30],
    ["Cetirizine", "Cetirizine", "AllerFree", "Antihistamine", "Tablet", "10 mg", "Relief Pharma", 48, 24, 70],
    ["Metformin", "Metformin Hydrochloride", "GlucoRight", "Antidiabetic", "Tablet", "500 mg", "DiaCare", 64, 38, 90],
    ["Amlodipine", "Amlodipine Besylate", "CardioEase", "Cardiac", "Tablet", "5 mg", "HeartWell", 58, 34, 80],
    ["Salbutamol Inhaler", "Salbutamol", "BreatheOn", "Respiratory", "Inhaler", "100 mcg", "AirLife", 210, 152, 20],
    ["Vitamin D3", "Cholecalciferol", "D-Shine", "Vitamin", "Softgel", "60000 IU", "NutraMed", 118, 72, 45],
    ["Azithromycin", "Azithromycin", "AziSure", "Antibiotic", "Tablet", "500 mg", "Care Labs", 142, 92, 35],
    ["Pantoprazole", "Pantoprazole", "PantoSafe", "Antacid", "Tablet", "40 mg", "MediCore", 86, 49, 55]
  ];

  const medicines = {};
  for (const [name, genericName, brand, category, dosageForm, strength, manufacturer, mrp, purchasePrice, reorderLevel] of medicineSeed) {
    medicines[name] = await upsert(Medicine, { name, strength }, {
      name,
      genericName,
      brand,
      categoryId: categories[category]._id,
      dosageForm,
      strength,
      manufacturer,
      mrp,
      purchasePrice,
      reorderLevel,
      active: true
    });
  }

  const batchSeed = [
    ["Amoxicillin", "AMX2608A", "Main Pharmacy", 75, "2026-08-30", "HealthPlus Distributors", "2026-04-16"],
    ["Paracetamol", "PAR2701B", "Main Pharmacy", 420, "2027-01-15", "HealthPlus Distributors", "2026-04-19"],
    ["Omeprazole", "OMP2606C", "Cold Storage", 18, "2026-06-05", "MediCore Wholesale", "2026-03-21"],
    ["Cetirizine", "CET2607A", "Main Pharmacy", 62, "2026-07-12", "CureLine Pharma Supply", "2026-05-05"],
    ["Metformin", "MET2702A", "Central Warehouse", 310, "2027-02-22", "LifeBridge Medicals", "2026-05-03"],
    ["Amlodipine", "AML2611A", "Emergency Ward Store", 48, "2026-11-18", "MediCore Wholesale", "2026-04-28"],
    ["Salbutamol Inhaler", "SAL2606A", "Main Pharmacy", 16, "2026-06-18", "CureLine Pharma Supply", "2026-05-01"],
    ["Vitamin D3", "D32612A", "Main Pharmacy", 122, "2026-12-09", "LifeBridge Medicals", "2026-05-08"],
    ["Azithromycin", "AZI2605X", "Main Pharmacy", 0, "2026-05-10", "HealthPlus Distributors", "2026-02-25"],
    ["Pantoprazole", "PAN2703A", "Central Warehouse", 210, "2027-03-14", "MediCore Wholesale", "2026-05-11"],
    ["Paracetamol", "PAR2606C", "Emergency Ward Store", 55, "2026-06-28", "HealthPlus Distributors", "2026-04-08"],
    ["Metformin", "MET2604X", "Main Pharmacy", 12, "2026-04-30", "LifeBridge Medicals", "2026-01-17"]
  ];

  for (const [medicine, batchNumber, location, quantity, expiryDate, supplier, receivedAt] of batchSeed) {
    await upsert(Inventory, { batchNumber, locationId: locations[location]._id }, {
      medicineId: medicines[medicine]._id,
      batchNumber,
      locationId: locations[location]._id,
      quantity,
      expiryDate,
      supplierId: suppliers[supplier]._id,
      receivedAt
    });
  }

  const purchaseSeed = [
    {
      poNumber: "PO-DEMO-260501",
      supplier: "HealthPlus Distributors",
      status: "Received",
      items: [["Paracetamol", 250, 18], ["Azithromycin", 80, 92]]
    },
    {
      poNumber: "PO-DEMO-260512",
      supplier: "MediCore Wholesale",
      status: "Created",
      items: [["Pantoprazole", 120, 49], ["Omeprazole", 90, 55]]
    },
    {
      poNumber: "PO-DEMO-260518",
      supplier: "LifeBridge Medicals",
      status: "Approved",
      items: [["Metformin", 300, 38], ["Vitamin D3", 100, 72]]
    }
  ];

  for (const order of purchaseSeed) {
    const items = order.items.map(([medicine, quantity, unitCost]) => ({
      medicineId: medicines[medicine]._id,
      medicineName: medicine,
      quantity,
      unitCost,
      amount: quantity * unitCost
    }));
    await upsert(PurchaseOrder, { poNumber: order.poNumber }, {
      poNumber: order.poNumber,
      supplierId: suppliers[order.supplier]._id,
      status: order.status,
      items,
      totalAmount: items.reduce((sum, item) => sum + item.amount, 0),
      createdBy: users["procurement@mims.local"]._id
    });
  }

  const saleSeed = [
    {
      invoiceNumber: "INV-DEMO-260515-001",
      customerName: "Walk-in Customer",
      customerType: "Retail",
      location: "Main Pharmacy",
      items: [["Paracetamol", "PAR2701B", 3, 32], ["Cetirizine", "CET2607A", 2, 48]]
    },
    {
      invoiceNumber: "INV-DEMO-260516-002",
      customerName: "City Clinic",
      customerType: "Clinic",
      location: "Main Pharmacy",
      items: [["Amoxicillin", "AMX2608A", 5, 128], ["Omeprazole", "OMP2606C", 2, 92]]
    },
    {
      invoiceNumber: "INV-DEMO-260519-003",
      customerName: "Emergency Ward",
      customerType: "Hospital",
      location: "Emergency Ward Store",
      items: [["Amlodipine", "AML2611A", 4, 58], ["Paracetamol", "PAR2606C", 10, 32]]
    }
  ];

  for (const sale of saleSeed) {
    const items = sale.items.map(([medicine, batchNumber, quantity, unitPrice]) => ({
      medicineId: medicines[medicine]._id,
      medicineName: medicine,
      batchNumber,
      quantity,
      unitPrice,
      amount: quantity * unitPrice
    }));
    await upsert(Sale, { invoiceNumber: sale.invoiceNumber }, {
      invoiceNumber: sale.invoiceNumber,
      customerName: sale.customerName,
      customerType: sale.customerType,
      locationId: locations[sale.location]._id,
      items,
      totalAmount: items.reduce((sum, item) => sum + item.amount, 0),
      processedBy: users["pharmacist@mims.local"]._id
    });
  }

  await AuditLog.create({
    actor: "system",
    action: "database:populate",
    details: "Loaded full PRD-aligned demo dataset"
  });

  const counts = {
    users: await User.countDocuments(),
    categories: await Category.countDocuments(),
    locations: await Location.countDocuments(),
    suppliers: await Supplier.countDocuments(),
    medicines: await Medicine.countDocuments(),
    inventoryBatches: await Inventory.countDocuments(),
    purchaseOrders: await PurchaseOrder.countDocuments(),
    sales: await Sale.countDocuments()
  };

  console.table(counts);
  await mongoose.disconnect();
}

main().catch(async error => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
