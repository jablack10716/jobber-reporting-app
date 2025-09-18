const JobberAPIService = require('./JobberAPIService');

async function testInvoices() {
  try {
    const service = new JobberAPIService();
    
    const query = `
      query {
        invoices(first: 3, filter: { createdAt: { after: "2025-08-01", before: "2025-08-31" } }) {
          edges {
            node {
              id
              invoiceNumber
              customFields {
                ... on CustomFieldText {
                  label
                  valueText
                }
              }
              lineItems(first: 2) {
                edges {
                  node {
                    description
                    quantity
                    unitPrice
                  }
                }
              }
            }
          }
        }
      }
    `;
    
    const data = await service.query(query);
    
    console.log('=== INVOICE SAMPLE (August 2025) ===');
    data.invoices.edges.forEach((edge, i) => {
      const invoice = edge.node;
      console.log(`\n--- Invoice ${i + 1}: ${invoice.invoiceNumber} ---`);
      console.log('Custom Fields:');
      invoice.customFields.forEach(field => {
        console.log(`  ${field.label}: "${field.valueText}"`);
      });
      console.log('Line Items:');
      invoice.lineItems.edges.forEach(item => {
        const li = item.node;
        console.log(`  ${li.description}: ${li.quantity} x $${li.unitPrice}`);
      });
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testInvoices();