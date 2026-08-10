import os
import sys
import boto3
import logging
from dotenv import load_dotenv

# Add project root to Python search path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Load env variables
load_dotenv(override=True)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("SageMakerManager")

aws_region = os.getenv("AWS_REGION", "us-east-1")
endpoint_name = os.getenv("SAGEMAKER_ENDPOINT_NAME", "gemma-2-9b-medqa-endpoint")

def get_sagemaker_client():
    session = boto3.Session(
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
        region_name=aws_region
    )
    return session.client("sagemaker")

def check_status():
    """Checks the current status of the SageMaker endpoint."""
    client = get_sagemaker_client()
    logger.info(f"Checking status for endpoint '{endpoint_name}' in region '{aws_region}'...")
    try:
        response = client.describe_endpoint(EndpointName=endpoint_name)
        status = response.get("EndpointStatus")
        logger.info(f"🎉 Endpoint '{endpoint_name}' exists!")
        logger.info(f"   Status: {status}")
        logger.info(f"   Created At: {response.get('CreationTime')}")
        logger.info(f"   Last Modified: {response.get('LastModifiedTime')}")
        return status
    except client.exceptions.ClientError as e:
        error_message = e.response["Error"]["Message"]
        if "Could not find endpoint" in error_message:
            logger.info(f"😴 Endpoint '{endpoint_name}' is currently INACTIVE (does not exist).")
            return "NotFound"
        else:
            logger.error(f"Error describing endpoint: {e}")
            return "Error"

def stop_endpoint():
    """Deletes the SageMaker endpoint to stop billing immediately."""
    client = get_sagemaker_client()
    status = check_status()
    
    if status == "NotFound":
        logger.info("Nothing to stop. The endpoint is already inactive.")
        return
        
    logger.info(f"⚠️ Deleting SageMaker endpoint '{endpoint_name}' to stop billing...")
    try:
        client.delete_endpoint(EndpointName=endpoint_name)
        logger.info(f"✅ Delete command issued successfully. The endpoint is shutting down.")
        logger.info("Keep in mind that the underlying Model and EndpointConfig are preserved in AWS, so you can recreate it quickly.")
    except Exception as e:
        logger.error(f"Failed to delete endpoint: {e}")

def start_endpoint():
    """Starts the endpoint deployment by importing and running the deployment function."""
    status = check_status()
    if status == "InService":
        logger.info("Endpoint is already active and InService. Nothing to do!")
        return
    elif status in ["Creating", "Updating"]:
        logger.info(f"Endpoint is currently in status '{status}'. Please wait for it to complete.")
        return
        
    logger.info("Launching SageMaker deployment script...")
    try:
        from fine_tuning.deploy_sagemaker import deploy
        deploy()
    except ImportError:
        logger.error("Could not import deploy function from fine_tuning.deploy_sagemaker. Make sure you run from the project root directory.")
    except Exception as e:
        logger.error(f"Deployment failed: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("\nMedGraph SageMaker Toggle Utility")
        print("Usage:")
        print("  python fine_tuning/manage_sagemaker.py status  - Check if endpoint is running")
        print("  python fine_tuning/manage_sagemaker.py start   - Spin up the ml.g5.xlarge GPU instance")
        print("  python fine_tuning/manage_sagemaker.py stop    - Tear down endpoint to stop billing")
        print()
        sys.exit(1)
        
    command = sys.argv[1].lower()
    if command == "status":
        check_status()
    elif command == "stop":
        stop_endpoint()
    elif command == "start":
        start_endpoint()
    else:
        logger.error(f"Unknown command '{command}'. Use 'status', 'start', or 'stop'.")
