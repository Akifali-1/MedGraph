import os
import sys
import logging
from dotenv import dotenv_values

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("SSMSecretsUploader")

# Standard configuration
PROJECT_NAME = "medgraph"
ENVIRONMENT = "prod"

# List of parameter names mapping (from .env to whether they are sensitive)
# Sensitive values are uploaded as 'SecureString', non-sensitive as 'String'
PARAMETERS_SCHEMAS = {
    "OPENAI_API_KEY": True,
    "GOOGLE_API_KEY": True,
    "PINECONE_API_KEY": True,
    "PINECONE_ENV": False,
    "PINECONE_INDEX_NAME": False,
    "COHERE_API_KEY": True,
    "NEO4J_URI": False,
    "NEO4J_USERNAME": False,
    "NEO4J_PASSWORD": True,
    "HF_MODEL_ID": False,
    "HF_API_TOKEN": True,
    "GOOGLE_CLIENT_ID": False,
    "GOOGLE_CLIENT_SECRET": True,
    "LANGCHAIN_API_KEY": True,
    # Signs every access token. Without it the backend falls back to the
    # in-repo dev default, so anyone could forge a token for any role.
    "AUTH_SECRET": True
}

def upload_secrets(dry_run=False):
    dotenv_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
    if not os.path.exists(dotenv_path):
        logger.error(f".env file not found at {dotenv_path}. Make sure it exists.")
        sys.exit(1)

    logger.info(f"Reading configuration from {dotenv_path}...")
    env_vars = dotenv_values(dotenv_path)
    
    # Initialize boto3 SSM client
    import boto3
    aws_region = env_vars.get("AWS_REGION", "us-east-1")
    
    # Set up session using explicit keys if they are in the .env, otherwise default credentials chain
    session_kwargs = {"region_name": aws_region}
    if env_vars.get("AWS_ACCESS_KEY_ID") and env_vars.get("AWS_SECRET_ACCESS_KEY"):
        session_kwargs["aws_access_key_id"] = env_vars.get("AWS_ACCESS_KEY_ID")
        session_kwargs["aws_secret_access_key"] = env_vars.get("AWS_SECRET_ACCESS_KEY")
        logger.info("Using AWS credentials provided in .env file.")
    else:
        logger.info("Using default AWS credentials provider chain.")
        
    session = boto3.Session(**session_kwargs)
    ssm_client = session.client("ssm")
    
    logger.info(f"Targeting SSM parameters path: /{PROJECT_NAME}/{ENVIRONMENT}/*")
    
    success_count = 0
    fail_count = 0
    
    for key, is_secure in PARAMETERS_SCHEMAS.items():
        value = env_vars.get(key)
        if not value:
            logger.warning(f"Parameter '{key}' is missing in .env. Skipping.")
            continue
            
        # Standardize placeholders
        if value.strip().lower().startswith("your_") or "placeholder" in value.lower():
            logger.warning(f"Parameter '{key}' has placeholder value. Skipping to prevent uploading bad keys.")
            continue
            
        param_name = f"/{PROJECT_NAME}/{ENVIRONMENT}/{key}"
        param_type = "SecureString" if is_secure else "String"
        
        logger.info(f"Preparing to upload {key} to {param_name} (Type: {param_type})...")
        
        if dry_run:
            logger.info(f"[DRY RUN] Would write SSM Parameter: {param_name} (Secure: {is_secure})")
            success_count += 1
            continue
            
        try:
            ssm_client.put_parameter(
                Name=param_name,
                Value=value,
                Type=param_type,
                Overwrite=True,
                Description=f"MedGraph AI config parameter for {key}"
            )
            logger.info(f"Successfully uploaded: {param_name}")
            success_count += 1
        except Exception as e:
            logger.error(f"Failed to upload {param_name}: {e}")
            fail_count += 1
            
    logger.info(f"Upload complete. Success: {success_count}, Failed: {fail_count}")

if __name__ == "__main__":
    dry_run = "--dry-run" in sys.argv
    upload_secrets(dry_run=dry_run)
