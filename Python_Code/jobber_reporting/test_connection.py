from jobber_reporting.auth import TokenManager

def test_connection():
    """Test the connection to Jobber's GraphQL API"""
    print("Testing Jobber API connection...")
    
    # Initialize the token manager
    token_mgr = TokenManager()
    print("✓ Token manager initialized successfully")
    
    # Test query - exact format that works in GraphiQL
    query = """query {
  account {
    id
    name
  }
}"""
    
    try:
        print("\nSending query:")
        print("---")
        print(query)
        print("---")
        result = token_mgr.execute_graphql(query)
        print("\n✓ Query successful!")
        print(f"Account Name: {result['data']['account']['name']}")
        
        # Show query cost information
        if 'extensions' in result and 'cost' in result['extensions']:
            cost = result['extensions']['cost']
            print("\nQuery Cost Information:")
            print(f"  Requested Cost: {cost['requestedQueryCost']}")
            print(f"  Actual Cost: {cost['actualQueryCost']}")
            if 'throttleStatus' in cost:
                ts = cost['throttleStatus']
                print(f"  Available Points: {ts['currentlyAvailable']} / {ts['maximumAvailable']}")
                print(f"  Restore Rate: {ts['restoreRate']} points/second")
        
        # Check API version
        if 'extensions' in result and 'versioning' in result['extensions']:
            current_version = '2024-03-05'  # Our current version
            server_version = result['extensions']['versioning']['version']
            if current_version != server_version:
                print(f"\n⚠️ API Version mismatch:")
                print(f"  Current: {current_version}")
                print(f"  Server:  {server_version}")
                print("Consider updating X-API-Version in auth.py")
    except Exception as e:
        print(f"\n⚠ Error: {str(e)}")
        raise

if __name__ == "__main__":
    test_connection()
