import React, { useState, useMemo, useRef, useEffect } from 'react';
import Papa from 'papaparse';
import { Html5QrcodeScanner } from 'html5-qrcode';

// Utility function to parse master list
const parseMasterList = (file, setMasterList) => {
  Papa.parse(file, {
    header: false,
    skipEmptyLines: true,
    complete: (results) => {
      // Expect CSV format with instrument number and serial number columns
      const processedData = results.data
        .map(row => {
          if (Array.isArray(row) && row.length >= 2) {
            // Keep both instrument number and serial number
            return `${String(row[0]).trim()},${String(row[1]).trim()}`;
          } else if (row.length === 1) {
            // If only one column, treat it as instrument number
            return `${String(row[0]).trim()},`;
          }
          return null;
        })
        .filter(item => item && item.split(',')[0]); // Ensure at least instrument number exists
      
      setMasterList([...new Set(processedData)]);
      alert(`Master List Loaded: ${new Set(processedData).size} unique instruments.`);
    },
    error: (error) => {
      console.error("Error parsing CSV:", error);
      alert("Error loading file. Check console.");
    }
  });
};

const BarcodeReconciler = () => {
  const [masterList, setMasterList] = useState([]);
  const [scannedData, setScannedData] = useState({});
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isUsingCamera, setIsUsingCamera] = useState(false);
  const [isManualEntry, setIsManualEntry] = useState(false);
  const [manualNumber, setManualNumber] = useState('');
  const scanInputRef = useRef(null);
  const qrScanner = useRef(null);

  // Drag-and-drop and click upload handler
  const handleDrop = (event) => {
    event.preventDefault();
    if (event.dataTransfer.files && event.dataTransfer.files[0]) {
      const file = event.dataTransfer.files[0];
      setUploadedFile(file);
      parseMasterList(file, setMasterList);
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  // Handle successful QR/barcode scans
  const onScanSuccess = (decodedText) => {
    processNumber(decodedText);
  };

  // Initialize and cleanup QR scanner
  useEffect(() => {
    if (isUsingCamera) {
      qrScanner.current = new Html5QrcodeScanner(
        "qr-reader",
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
          showTorchButtonIfSupported: true,
        }
      );
      qrScanner.current.render(onScanSuccess);
    } else if (qrScanner.current) {
      qrScanner.current.clear();
    }

    return () => {
      if (qrScanner.current) {
        qrScanner.current.clear();
      }
    };
  }, [isUsingCamera]);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setUploadedFile(file);
      parseMasterList(file, setMasterList);
    }
  };

  const processNumber = (number) => {
    if (!number) return;
    
    // Check for matching instrument or serial number in the master list
    const normalizedNumber = number.trim().toUpperCase();
    const match = masterList.find(item => {
      const [instrNum, serialNum] = item.split(',').map(n => n.trim().toUpperCase());
      return normalizedNumber === instrNum || normalizedNumber === serialNum;
    });

    if (match) {
      // Use the instrument number for tracking, even if serial number was scanned
      const instrumentNumber = match.split(',')[0].trim();
      setScannedData(prev => ({
        ...prev,
        [instrumentNumber]: (prev[instrumentNumber] || 0) + 1,
      }));
      return true;
    }
    return false;
  };

  const handleScan = (event) => {
    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      const scannedNumber = event.target.value.trim();
      if (processNumber(scannedNumber)) {
        event.target.value = '';
      } else {
        alert('Number not found in master list. Please check and try again.');
      }
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (processNumber(manualNumber)) {
      setManualNumber('');
    } else {
      alert('Number not found in master list. Please check and try again.');
    }
  };

  const report = useMemo(() => {
    const missing = [];
    const excess = [];
    const short = {};
    const matched = [];

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

  return (
        <div style={{ 
        padding: '32px 24px',
        maxWidth: '1000px',
        margin: '32px auto',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08)',
      }}>
      <h1 style={{ 
        background: 'linear-gradient(135deg, #003087 0%, #0057b8 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        marginBottom: '24px',
        fontSize: '2.5rem',
        fontWeight: '700',
        letterSpacing: '-0.025em',
        textAlign: 'center',
        marginBottom: '30px',
        fontSize: '2.5rem',
        fontWeight: '600',
        letterSpacing: '-0.5px',
        textAlign: 'center',
        background: 'linear-gradient(135deg, #003087 0%, #0057b8 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
      }}>Serialized Cycle Count</h1>
      
      <h2 style={{ 
        color: '#0057b8',
        fontSize: '1.5rem',
        fontWeight: '500',
        marginBottom: '20px',
        padding: '10px 0',
        borderBottom: '2px solid #e3e8f3'
      }}>1. Load Master Inventory</h2>
      <p style={{ 
        marginBottom: '20px', 
        color: '#4a5568',
        fontSize: '1rem',
        lineHeight: '1.5',
        padding: '12px',
        backgroundColor: 'rgba(0, 87, 184, 0.05)',
        borderRadius: '8px',
        border: '1px solid rgba(0, 87, 184, 0.1)'
      }}>
        Export On-Hand Inventory In DAX and upload it from a browser or from your phone. Do not change anything other than filtering out non counted locations or non-serialized inventory.
      </p>
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        style={{
          border: '2px dashed #0057b8',
          borderRadius: '12px',
          padding: '40px',
          textAlign: 'center',
          background: 'linear-gradient(to bottom, #f8f9ff 0%, #ffffff 100%)',
          marginBottom: '24px',
          cursor: masterList.length > 0 ? 'not-allowed' : 'pointer',
          opacity: masterList.length > 0 ? 0.5 : 1,
          transition: 'all 0.2s ease-in-out',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
          '&:hover': {
            borderColor: '#003087',
            background: 'linear-gradient(to bottom, #f0f4ff 0%, #ffffff 100%)',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
          }
        }}
        title={masterList.length > 0 ? 'Master list already loaded' : 'Drag and drop or click to upload'}
        onClick={() => {
          if (masterList.length === 0) {
            document.getElementById('masterlist-upload').click();
          }
        }}
      >
        <input
          id="masterlist-upload"
          type="file"
          accept=".csv,.xlsx,.xls,.txt"
          style={{ display: 'none' }}
          onChange={handleFileUpload}
          disabled={masterList.length > 0}
        />
        {uploadedFile ? (
          <div>
            <strong>Uploaded:</strong> {uploadedFile.name}
          </div>
        ) : (
          <div>
            <span role="img" aria-label="upload">📤</span> <br />
            <span>Drag and drop or click to upload your masterlist (.csv, .xlsx, .xls, .txt)</span>
          </div>
        )}
      </div>
      <p>Expected Instruments Loaded: <strong>{report.totalExpected}</strong></p>
      <hr />

      <h2 style={{ 
        color: '#0057b8',
        fontSize: '1.75rem',
        fontWeight: '600',
        marginTop: '32px',
        marginBottom: '16px',
        borderBottom: '2px solid rgba(0, 87, 184, 0.2)',
        paddingBottom: '8px'
      }}>2. Scan Barcodes</h2>
      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={() => setIsUsingCamera(!isUsingCamera)}
          style={{
            padding: '12px 24px',
            marginBottom: '15px',
            background: isUsingCamera 
              ? 'linear-gradient(135deg, #cc0000 0%, #ff1a1a 100%)'
              : 'linear-gradient(135deg, #003087 0%, #0057b8 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: '500',
            transition: 'transform 0.2s, box-shadow 0.2s',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
            '&:hover': {
              transform: 'translateY(-1px)',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.15)'
            }
          }}
        >
          {isUsingCamera ? 'Stop Camera' : 'Use Camera to Scan'}
        </button>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={() => setIsManualEntry(!isManualEntry)}
          style={{
            padding: '12px 24px',
            marginBottom: '15px',
            marginRight: '12px',
            background: isManualEntry
              ? 'linear-gradient(135deg, #666666 0%, #999999 100%)'
              : 'linear-gradient(135deg, #003087 0%, #0057b8 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: '500',
            transition: 'transform 0.2s, box-shadow 0.2s',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
          }}
        >
          {isManualEntry ? 'Switch to Scanner' : 'Manual Entry'}
        </button>
      </div>

      {isUsingCamera ? (
        <div id="qr-reader" style={{ width: '100%', maxWidth: '600px', margin: '0 auto' }}></div>
      ) : isManualEntry ? (
        <form onSubmit={handleManualSubmit} style={{ marginBottom: '20px' }}>
          <div style={{ marginBottom: '12px' }}>
            <input
              type="text"
              value={manualNumber}
              onChange={(e) => setManualNumber(e.target.value)}
              placeholder="Enter Instrument or Serial Number..."
              style={{
                width: '100%',
                maxWidth: '400px',
                padding: '12px 16px',
                fontSize: '1.1rem',
                borderRadius: '8px',
                border: '2px solid #e2e8f0',
                marginRight: '12px',
                transition: 'all 0.2s ease-in-out',
                outline: 'none',
                marginBottom: '12px'
              }}
            />
          </div>
          <button
            type="submit"
            style={{
              padding: '12px 24px',
              background: 'linear-gradient(135deg, #003087 0%, #0057b8 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: '500',
              transition: 'transform 0.2s, box-shadow 0.2s',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
            }}
          >
            Add Number
          </button>
        </form>
      ) : (
        <>
          <p>Click the box below and start scanning. You can scan either the instrument number or manufacturer's serial number.</p>
          <input
            ref={scanInputRef}
            type="text"
            placeholder="Scan Instrument or Serial Number..."
            style={{
              width: '100%',
              maxWidth: '400px',
              padding: '12px 16px',
              fontSize: '1.125rem',
              borderRadius: '8px',
              border: '2px solid #e2e8f0',
              transition: 'all 0.2s ease-in-out',
              outline: 'none',
              boxSizing: 'border-box',
              '&:focus': {
                borderColor: '#0057b8',
                boxShadow: '0 0 0 3px rgba(0, 87, 184, 0.1)'
              }
            }}
            onKeyDown={handleScan}
            autoFocus
          />
        </>
      )}
      <p>Total Scans Received: <strong>{report.totalScanned}</strong></p>
      <hr />

      <h2 style={{ 
        color: '#0057b8',
        fontSize: '1.75rem',
        fontWeight: '600',
        marginTop: '32px',
        marginBottom: '16px',
        borderBottom: '2px solid rgba(0, 87, 184, 0.2)',
        paddingBottom: '8px'
      }}>3. Reconciliation Report</h2>
      
      <div style={{
        backgroundColor: '#f8faff',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '32px',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
        border: '1px solid rgba(0, 87, 184, 0.1)'
      }}>
        <h3 style={{ 
          color: '#003087',
          fontSize: '1.25rem',
          fontWeight: '600',
          marginBottom: '16px'
        }}>Summary</h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '8px'
        }}>
          <div style={{
            padding: '16px',
            backgroundColor: 'white',
            borderRadius: '8px',
            border: '1px solid rgba(0, 87, 184, 0.1)'
          }}>
            <div style={{ color: '#666', marginBottom: '4px' }}>Total Expected</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#003087' }}>{report.totalExpected}</div>
          </div>
          <div style={{
            padding: '16px',
            backgroundColor: 'white',
            borderRadius: '8px',
            border: '1px solid rgba(0, 87, 184, 0.1)'
          }}>
            <div style={{ color: '#666', marginBottom: '4px' }}>Total Scanned</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#003087' }}>{report.totalScanned}</div>
          </div>
          <div style={{
            padding: '16px',
            backgroundColor: 'white',
            borderRadius: '8px',
            border: '1px solid rgba(0, 87, 184, 0.1)'
          }}>
            <div style={{ color: '#666', marginBottom: '4px' }}>Correctly Matched</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#003087' }}>{report.matched.length}</div>
          </div>
        </div>
      </div>

      <h3 style={{ 
        color: '#003087',
        fontSize: '1.25rem',
        fontWeight: '600',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '16px'
      }}>
        <span role="img" aria-label="warning" style={{ fontSize: '1.5rem' }}>🚨</span>
        Over/Excess Count
        <span style={{ 
          fontSize: '1rem',
          fontWeight: 'normal',
          color: '#666',
          marginLeft: 'auto'
        }}>
          Count: {report.excess.length}
        </span>
      </h3>
      <div style={{ 
        padding: '20px',
        backgroundColor: 'rgba(255, 244, 229, 0.5)',
        borderRadius: '12px',
        marginBottom: '32px',
        border: '1px solid rgba(255, 159, 67, 0.2)',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
      }}>
        <ul style={{ 
          listStyleType: 'none', 
          padding: 0, 
          margin: 0,
          display: 'grid',
          gap: '12px'
        }}>
          {report.excess.map(item => (
            <li key={item.number} style={{ 
              padding: '12px 16px',
              backgroundColor: 'white',
              borderRadius: '8px',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span style={{ 
                color: '#0057b8',
                fontWeight: '600',
                fontSize: '1.1rem'
              }}>{item.number}</span>
              <span style={{ 
                color: '#666',
                fontSize: '0.9rem',
                backgroundColor: 'rgba(0, 87, 184, 0.1)',
                padding: '4px 8px',
                borderRadius: '12px'
              }}>
                Scanned {item.count} time(s)
              </span>
            </li>
          ))}
        </ul>
      </div>

      <h3 style={{ 
        color: '#003087',
        fontSize: '1.25rem',
        fontWeight: '600',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '16px'
      }}>
        <span role="img" aria-label="warning" style={{ fontSize: '1.5rem' }}>⚠️</span>
        Short/Duplicate Count
        <span style={{ 
          fontSize: '1rem',
          fontWeight: 'normal',
          color: '#666',
          marginLeft: 'auto'
        }}>
          Count: {Object.keys(report.short).length}
        </span>
      </h3>
      <div style={{ 
        padding: '20px',
        backgroundColor: 'rgba(255, 252, 220, 0.5)',
        borderRadius: '12px',
        marginBottom: '32px',
        border: '1px solid rgba(246, 190, 0, 0.2)',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
      }}>
        <ul style={{ 
          listStyleType: 'none', 
          padding: 0, 
          margin: 0,
          display: 'grid',
          gap: '12px'
        }}>
          {Object.keys(report.short).map(number => (
            <li key={number} style={{ 
              padding: '12px 16px',
              backgroundColor: 'white',
              borderRadius: '8px',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span style={{ 
                color: '#f6be00',
                fontWeight: '600',
                fontSize: '1.1rem'
              }}>{number}</span>
              <span style={{ 
                color: '#666',
                fontSize: '0.9rem',
                backgroundColor: 'rgba(246, 190, 0, 0.1)',
                padding: '4px 8px',
                borderRadius: '12px'
              }}>
                Scanned {report.short[number]} time(s)
              </span>
            </li>
          ))}
        </ul>
      </div>

      <h3 style={{ 
        color: '#003087',
        fontSize: '1.25rem',
        fontWeight: '600',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '16px'
      }}>
        <span role="img" aria-label="error" style={{ fontSize: '1.5rem' }}>❌</span>
        Under/Missing Count
        <span style={{ 
          fontSize: '1rem',
          fontWeight: 'normal',
          color: '#666',
          marginLeft: 'auto'
        }}>
          Count: {report.missing.length}
        </span>
      </h3>
      <div style={{ 
        maxHeight: '300px',
        overflowY: 'auto',
        padding: '20px',
        backgroundColor: 'rgba(255, 235, 235, 0.5)',
        borderRadius: '12px',
        marginBottom: '32px',
        border: '1px solid rgba(204, 0, 0, 0.2)',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
      }}>
        <ul style={{ 
          listStyleType: 'none', 
          padding: 0, 
          margin: 0,
          display: 'grid',
          gap: '12px'
        }}>
          {report.missing.map(number => (
            <li key={number} style={{ 
              padding: '12px 16px',
              backgroundColor: 'white',
              borderRadius: '8px',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
              display: 'flex',
              alignItems: 'center'
            }}>
              <span style={{ 
                color: '#cc0000',
                fontWeight: '600',
                fontSize: '1.1rem'
              }}>{number}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default BarcodeReconciler;
