// GraphQL queries for Jobber API
// Reference: https://developer.getjobber.com/docs/graphql

const ACCOUNT_QUERY = `
  query {
    account {
      id
      name
    }
  }
`;

const JOBS_QUERY = `
  query GetJobs($first: Int, $after: String, $jobStatus: [JobStatus!]) {
    jobs(first: $first, after: $after, jobStatus: $jobStatus) {
      edges {
        node {
          id
          jobNumber
          title
          description
          jobStatus
          startAt
          endAt
          client {
            id
            name
          }
          property {
            id
            address {
              street1
              city
              province
              postalCode
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

const CLIENTS_QUERY = `
  query GetClients($first: Int, $after: String) {
    clients(first: $first, after: $after) {
      edges {
        node {
          id
          name
          email
          phoneNumber
          companyName
          tags
          properties {
            edges {
              node {
                id
                address {
                  street1
                  city
                  province
                  postalCode
                }
              }
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

const INVOICES_QUERY = `
  query GetInvoices($first: Int, $after: String) {
    invoices(first: $first, after: $after) {
      edges {
        node {
          id
          invoiceNumber
          subject
          total
          subtotal
          tax
          invoiceStatus
          client {
            id
            name
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

const TIME_SHEETS_QUERY = `
  query GetTimeSheets($first: Int, $after: String, $startDate: DateTime, $endDate: DateTime) {
    timeSheets(first: $first, after: $after, startDate: $startDate, endDate: $endDate) {
      edges {
        node {
          id
          startAt
          endAt
          totalTime
          description
          user {
            id
            name {
              first
              last
            }
          }
          job {
            id
            jobNumber
            title
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

const USERS_QUERY = `
  query GetUsers($first: Int, $after: String) {
    users(first: $first, after: $after) {
      edges {
        node {
          id
          name {
            first
            last
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

module.exports = {
  ACCOUNT_QUERY,
  JOBS_QUERY,
  CLIENTS_QUERY,
  INVOICES_QUERY,
  TIME_SHEETS_QUERY,
  USERS_QUERY
};