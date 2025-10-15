import React, { useState, useMemo, useRef } from 'react';
import Papa from 'papaparse'; // You'd install this library: npm install papaparse

// --- Utility Functions (Put these outside the component) ---

// Function to parse a list of instrument numbers from the master list file
const parseMasterList = (file, setMasterList) => {
  Papa.parse(file, {
    header: false, // Assuming the instrument number is the only/first column
    skipEmptyLines: true,
    complete: (results) => {
      // Flatten the 2D array and filter out non-string/empty values
      const numbers = results.data
        .flat()
        .map(item => String(item).trim())
        .filter(item => item); 
      setMasterList([...new Set(numbers)]); // Use Set to ensure uniqueness
      alert(`Master List Loaded: ${new Set(numbers).size} unique instruments.`);
    },
    error: (error) => {
      console.error("Error parsing CSV:", error);
      alert("Error loading file. Check console.");
    }
  });
};

// --- Main Component ---
const BarcodeReconciler = () => {
  const [masterList, setMasterList] = useState([]); // Array of expected Instrument Numbers
  const [scannedData, setScannedData] = useState({}); // Object: { instrumentNumber: count }
  const scanInputRef = useRef(null); // Ref for focusing the scan input

  // Handler for uploading the master CSV file
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      parseMasterList(file, setMasterList);
    }
  };

  // Handler for each barcode scan (triggered by key press/scanner input)
  const handleScan = (event) => {
    // Check if the scanner pressed 'Enter' (keyCode 13) or 'Tab' (keyCode 9)
    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault(); 
      const scannedNumber = event.target.value.trim();

      if (scannedNumber) {
        setScannedData(prev => ({
          ...prev,
          // Increment the count for the scanned number
          [scannedNumber]: (prev[scannedNumber] || 0) + 1,
        }));
        event.target.value = ''; // Clear the input field for the next scan
      }
    }
  };
  
  // Logic for reconciliation (recalculated only when masterList or scannedData changes)
  const report = useMemo(() => {
    const missing = [];
    const excess = [];
    const short = {}; // For items scanned more than expected (usually > 1)
    const matched = [];

    // 1. Check Master List items for Missing or Matched/Short
    masterList.forEach(item => {
      const actualCount = scannedData[item] || 0;
      if (actualCount === 0) {
        missing.push(item);
      } else if (actualCount === 1) {
        matched.push(item);
      } else if (actualCount > 1) {
        short[item] = actualCount;
      }
    });

    // 2. Check Scanned Data items for Excess (not in Master List)
    Object.keys(scannedData).forEach(item => {
      if (!masterList.includes(item)) {
        excess.push({ 
          number: item, 
          count: scannedData[item] 
        });
      }
    });

    const totalScanned = Object.values(scannedData).reduce((sum, count) => sum + count, 0);

    return {
      totalExpected: masterList.length,
      totalScanned: totalScanned,
      missing,
      excess,
      short,
      matched,
    };
  }, [masterList, scannedData]);

  // UI structure
  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: 'auto' }}>
      <h1>Barcode Inventory Reconciler</h1>
      
      {/* 1. UPLOAD SECTION */}
      <h2>1. Load Master Inventory</h2>
      <input 
        type="file" 
        accept=".csv,.txt" 
        onChange={handleFileUpload} 
        disabled={masterList.length > 0}
      />
      <p>Expected Instruments Loaded: <strong>{report.totalExpected}</strong></p>
      <hr />

      {/* 2. SCANNING SECTION */}
      <h2>2. Scan Barcodes</h2>
      <p>Click the box below and start scanning. The scanner input is usually followed by an 'Enter' key.</p>
      <input
        ref={scanInputRef}
        type="text"
        placeholder="Scan Instrument Number Here..."
        onKeyDown={handleScan}
        style={{ fontSize: '18px', padding: '10px', width: '100%', boxSizing: 'border-box' }}
        autoFocus // Ensure the input is ready for scanning immediately
      />
      <p>Total Scans Received: <strong>{report.totalScanned}</strong></p>
      <hr />

      {/* 3. REPORT SECTION */}
      <h2>3. Reconciliation Report</h2>
      
      <h3>Summary</h3>
      <p><strong>Total Expected:</strong> {report.totalExpected}</p>
      <p><strong>Total Scanned (Items):</strong> {report.totalScanned}</p>
      <p><strong>Correctly Matched:</strong> {report.matched.length}</p>

      <h3>🚨 Over/Excess Count (Scanned, but NOT Expected)</h3>
      <p style={{ color: 'red' }}><strong>Count: {report.excess.length}</strong></p>
      <ul>
        {report.excess.map(item => (
          <li key={item.number}>{item.number} (Scanned {item.count} time(s))</li>
        ))}
      </ul>
      
      <h3>⚠️ Short/Duplicate Count (Expected, but Scanned &gt; 1)</h3>
      <p style={{ color: 'orange' }}><strong>Count: {Object.keys(report.short).length}</strong></p>
      <ul>
        {Object.keys(report.short).map(number => (
          <li key={number}>{number} (Scanned {report.short[number]} time(s))</li>
        ))}
      </ul>

      <h3>❌ Under/Missing Count (Expected, but NOT Scanned)</h3>
      <p style={{ color: 'darkred' }}><strong>Count: {report.missing.length}</strong></p>
      <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #ccc', padding: '10px' }}>
        <ul>
          {report.missing.map(number => (
            <li key={number}>{number}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default BarcodeReconciler;