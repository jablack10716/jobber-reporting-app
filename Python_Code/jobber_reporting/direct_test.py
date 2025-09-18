import requests
import json

def test_graphql():
    """Test a GraphQL query directly"""
    # Replace with your actual access token from tokens.json or environment
    access_token = "YOUR_ACCESS_TOKEN_HERE"

    # Headers
    headers = {
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-API-Version': '2024-03-05'
    }

    # The query that works in GraphiQL
    query = """query {
  account {
    id
    name
  }
}"""

    # Payload
    payload = {
        'query': query,
        'variables': {}
    }

    print("\nSending GraphQL request...")
    print("Headers:", json.dumps(headers, indent=2))
    print("Payload:", json.dumps(payload, indent=2))

    # Make the request
    response = requests.post(
        'https://api.getjobber.com/api/graphql',
        headers=headers,
        json=payload
    )

    print(f"\nResponse Status: {response.status_code}")
    print(f"Response Headers: {dict(response.headers)}")
    print(f"Response Body: {response.text}")

if __name__ == "__main__":
    test_graphql()
