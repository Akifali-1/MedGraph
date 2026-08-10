import os
import boto3
import logging
from dotenv import load_dotenv

# Load env variables
load_dotenv(override=True)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("SageMakerDeployer")

def deploy():
    # 1. Config Settings
    # Your private HuggingFace model repository ID (where you pushed the adapter)
    # The container will automatically load the base model from adapter_config.json's base_model_name_or_path
    hf_model_id = os.getenv("HF_MODEL_ID", "your_hf_username/gemma-2-9b-medqa-lora")
    hf_api_token = os.getenv("HF_API_TOKEN", "your_huggingface_token")
    
    role_arn = os.getenv("AWS_ROLE_ARN")
    aws_region = os.getenv("AWS_REGION", "us-east-1")
    endpoint_name = os.getenv("SAGEMAKER_ENDPOINT_NAME", "gemma-2-9b-medqa-endpoint")
    
    if not role_arn:
        logger.error(
            "AWS_ROLE_ARN environment variable is not configured. "
            "Please create an IAM Role with SageMaker Full Access and add its ARN to your environment."
        )
        return

    logger.info("Initializing SageMaker deployment...")
    
    try:
        import sagemaker
        from sagemaker.huggingface import HuggingFaceModel
    except ImportError:
        logger.error("sagemaker SDK not installed. Please run: pip install sagemaker")
        return

    # Create SageMaker session with custom boto3 configuration if needed
    boto_session = boto3.Session(
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
        region_name=aws_region
    )
    sagemaker_session = sagemaker.Session(boto_session=boto_session)

    # Clean up pre-existing endpoint config if it exists to prevent ValidationException
    try:
        sm_client = boto_session.client("sagemaker")
        sm_client.delete_endpoint_config(EndpointConfigName=endpoint_name)
        logger.info(f"Deleted pre-existing endpoint configuration '{endpoint_name}' to avoid conflicts.")
    except Exception:
        pass

    # 2. Retrieve Hugging Face LLM TGI Container URI
    # TGI container provides high-performance text generation with GPU support
    try:
        llm_image = sagemaker.image_uris.retrieve(
            framework="huggingface-llm",
            region=aws_region,
            version="2.3.1"
        )
        logger.info(f"Retrieved SageMaker HuggingFace container URI: {llm_image}")
    except Exception as e:
        logger.error(f"Failed to retrieve container URI: {e}")
        return

    # 3. Define Model Configuration
    huggingface_model = HuggingFaceModel(
        role=role_arn,
        image_uri=llm_image,
        env={
            "HF_MODEL_ID": hf_model_id,           # Points to HuggingFace Hub repo
            "HF_API_TOKEN": hf_api_token,         # Read token to pull from private HF repo
            "HF_TASK": "text-generation",
            "MAX_INPUT_LENGTH": "1024",
            "MAX_TOTAL_TOKENS": "2048",
            "NUMBER_OF_GPUS": "1",                # Fits on a single GPU
            "SM_NUM_GPUS": "1",
            "CUDA_GRAPHS": "0"                    # Disable CUDA graphs to boot instantly on NVIDIA T4
        },
        sagemaker_session=sagemaker_session
    )

    # 4. Deploy Model
    # ml.g5.xlarge uses an NVIDIA A10G (24GB VRAM, Ampere sm_80+) which is required for Gemma 2
    # Gemma 2 uses sliding window attention which requires Flash Attention 2 (Ampere+)
    # The T4 (ml.g4dn.xlarge, Turing sm_75) does NOT support Flash Attention 2 and will crash
    instance_type = "ml.g5.xlarge"
    logger.info(f"Deploying model to endpoint '{endpoint_name}' on instance '{instance_type}'...")
    logger.info("Note: SageMaker deployment takes approximately 5 to 10 minutes to initialize...")
    
    try:
        predictor = huggingface_model.deploy(
            initial_instance_count=1,
            instance_type=instance_type,
            endpoint_name=endpoint_name,
            container_startup_health_check_timeout=900  # Give container up to 15 min if needed
        )
        logger.info(f"Successfully deployed SageMaker endpoint! Connection string: {predictor.endpoint_name}")
    except Exception as e:
        logger.error(f"SageMaker Deployment failed: {e}")

if __name__ == "__main__":
    deploy()
