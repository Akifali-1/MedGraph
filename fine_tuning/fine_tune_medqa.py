import os
os.environ["PYTORCH_ALLOC_CONF"] = "expandable_segments:True"

import gc
import torch
gc.collect()
torch.cuda.empty_cache()
import torch
from datasets import load_dataset
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
from peft import LoraConfig, prepare_model_for_kbit_training, get_peft_model
from trl import SFTTrainer, SFTConfig
from huggingface_hub import login, HfApi

# Retrieve token dynamically from environment or Google Colab userdata
hf_token = os.getenv("HF_API_TOKEN")
if not hf_token:
    try:
        from google.colab import userdata
        hf_token = userdata.get("HF_API_TOKEN")
    except ImportError:
        pass
    except Exception:
        pass

if hf_token:
    login(token=hf_token)
else:
    print("Warning: HF_API_TOKEN not found in environment or Colab userdata. HuggingFace login skipped.")

MODEL_ID = "google/gemma-2-2b-it"
DATASET_ID = "openlifescienceai/medqa"
OUTPUT_DIR = "./gemma-2-2b-medqa-lora"
HF_REPO_ID = "Akif-Ali/gemma-2-2b-medgraph"

def format_instruction(sample):
    data = sample["data"]
    question = data["Question"]
    options = data["Options"]
    answer = data["Correct Answer"]
    options_str = "\n".join([f"({k}) {v}" for k, v in options.items()])
    prompt = (
        f"<start_of_turn>user\n"
        f"You are a clinical decision support AI. Answer this medical question.\n\n"
        f"Question:\n{question}\n\n"
        f"Options:\n{options_str}\n"
        f"Select the correct option and justify briefly.<end_of_turn>\n"
        f"<start_of_turn>model\n"
    )
    response = f"Correct Answer: {answer}<end_of_turn>"
    return {"text": prompt + response}

def main():
    gc.collect()
    torch.cuda.empty_cache()

    print("--- Loading dataset ---")
    dataset = load_dataset(DATASET_ID)
    train_dataset = dataset["train"]
    val_dataset = dataset.get("dev", None)
    print(f"Train: {len(train_dataset)} examples")

    print("--- Formatting ---")
    train_dataset = train_dataset.map(format_instruction, remove_columns=train_dataset.column_names)
    if val_dataset:
        val_dataset = val_dataset.map(format_instruction, remove_columns=val_dataset.column_names)

    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_use_double_quant=True,
        bnb_4bit_compute_dtype=torch.float16
    )

    print("--- Loading tokenizer ---")
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, trust_remote_code=True)
    tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "right"

    print("--- Loading model ---")
    model = AutoModelForCausalLM.from_pretrained(
        MODEL_ID,
        quantization_config=bnb_config,
        device_map="auto",
        trust_remote_code=True
    )
    model.gradient_checkpointing_enable()
    model = prepare_model_for_kbit_training(model)

    print("--- Applying LoRA ---")
    peft_config = LoraConfig(
        r=16,
        lora_alpha=32,
        target_modules=["q_proj", "v_proj", "k_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM"
    )
    

    print("--- Training ---")
    sft_config = SFTConfig(
      output_dir=OUTPUT_DIR,
      learning_rate=2e-4,
      per_device_train_batch_size=1,        # reduced from 2
      gradient_accumulation_steps=8,        # increased to compensate
      max_steps=500,
      logging_steps=10,
      save_strategy="steps",
      save_steps=100,
      eval_strategy="no",                   # disable eval — saves memory
      fp16=False,
      bf16=True,
      optim="paged_adamw_8bit",
      report_to="none",
      max_length=512,                       # reduced from 1024
      dataset_text_field="text",
      remove_unused_columns=False,
      packing=False,
)

    trainer = SFTTrainer(
        model=model,
        args=sft_config,
        train_dataset=train_dataset,
        eval_dataset=val_dataset,
        peft_config=peft_config,
        processing_class=tokenizer,
    )

    trainer.train()

    print("--- Saving ---")
    trainer.model.save_pretrained(OUTPUT_DIR)
    tokenizer.save_pretrained(OUTPUT_DIR)

    print("--- Pushing to HuggingFace ---")
    api = HfApi()
    api.create_repo(repo_id=HF_REPO_ID, private=True, exist_ok=True)
    api.upload_folder(
        folder_path=OUTPUT_DIR,
        repo_id=HF_REPO_ID,
        repo_type="model"
    )
    print(f"Done. Pushed to: {HF_REPO_ID}")

if __name__ == "__main__":
    main()
