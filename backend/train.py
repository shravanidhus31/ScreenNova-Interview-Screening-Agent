import torch
import re
from datasets import load_dataset
from transformers import (
    AutoTokenizer, 
    AutoModelForTokenClassification, 
    TrainingArguments, 
    Trainer,
    DataCollatorForTokenClassification
)
import evaluate
import numpy as np

# 1. Configuration
MODEL_NAME = "bert-base-uncased"
DATA_FILE = "dataset.json"
OUTPUT_DIR = "./jobbert-ner-model"

# Because your dataset doesn't specify *types* of entities (just a list of them),
# we simplify our labels to just "Entity" or "Not Entity" ("O").
label_list = ["O", "B-ENTITY", "I-ENTITY"]
label2id = {l: i for i, l in enumerate(label_list)}
id2label = {i: l for i, l in enumerate(label_list)}

# 2. Load Tokenizer & Model
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
model = AutoModelForTokenClassification.from_pretrained(
    MODEL_NAME, 
    num_labels=len(label_list),
    id2label=id2label,
    label2id=label2id
)

# 3. Load Dataset
dataset = load_dataset("json", data_files={"train": DATA_FILE})

# 4. Custom Preprocessing for Pipe-Separated Data
def tokenize_and_align_labels(examples):
    # We need offset_mapping to figure out where tokens are in the original string
    tokenized_inputs = tokenizer(
        examples["resume"], 
        truncation=True, 
        max_length=512,
        return_offsets_mapping=True,
        padding="max_length"
    )

    labels = []
    for i, text in enumerate(examples["resume"]):
        # Split the pipe-separated string into a list of words
        raw_entities = examples["entities"][i]
        if raw_entities is None:
            raw_entities = ""
        entity_strings = [e.strip() for e in raw_entities.split("|") if e.strip()]

        # Find where these entities appear in the raw text using regex
        spans = []
        for ent in entity_strings:
            pattern = re.escape(ent)
            for match in re.finditer(pattern, text, re.IGNORECASE):
                spans.append(match.span())

        # Map the character spans to our BERT tokens
        offset_mapping = tokenized_inputs["offset_mapping"][i]
        label_ids = []
        
        for offset in offset_mapping:
            token_start, token_end = offset
            if token_start == token_end: # It's a special token (like [CLS]) or padding
                label_ids.append(-100)
                continue

            token_label = "O"
            for (ent_start, ent_end) in spans:
                # If the token falls inside an entity's character span
                if token_start >= ent_start and token_end <= ent_end:
                    if token_start == ent_start:
                        token_label = "B-ENTITY" # Beginning of an entity
                    else:
                        token_label = "I-ENTITY" # Inside an entity
                    break
                    
            label_ids.append(label2id[token_label])
            
        labels.append(label_ids)

    tokenized_inputs["labels"] = labels
    tokenized_inputs.pop("offset_mapping") # Clean up, the model doesn't need this
    return tokenized_inputs

print("Tokenizing and aligning data. This might take a minute...")
tokenized_datasets = dataset.map(tokenize_and_align_labels, batched=True)

# 5. Metrics
seqeval = evaluate.load("seqeval")

def compute_metrics(p):
    predictions, labels = p
    predictions = np.argmax(predictions, axis=2)

    true_predictions = [
        [label_list[p] for (p, l) in zip(prediction, label) if l != -100]
        for prediction, label in zip(predictions, labels)
    ]
    true_labels = [
        [label_list[l] for (p, l) in zip(prediction, label) if l != -100]
        for prediction, label in zip(predictions, labels)
    ]

    results = seqeval.compute(predictions=true_predictions, references=true_labels)
    return {
        "precision": results["overall_precision"],
        "recall": results["overall_recall"],
        "f1": results["overall_f1"],
        "accuracy": results["overall_accuracy"],
    }

# 6. Training Arguments
training_args = TrainingArguments(
    output_dir=OUTPUT_DIR,
    learning_rate=2e-5,
    per_device_train_batch_size=8,
    num_train_epochs=3,
    weight_decay=0.01,
    save_strategy="epoch",
    eval_strategy="no", 
    remove_unused_columns=True
)

data_collator = DataCollatorForTokenClassification(tokenizer=tokenizer)

trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=tokenized_datasets["train"],
    processing_class=tokenizer,
    data_collator=data_collator,
    compute_metrics=compute_metrics,
)

# 7. Execute
if __name__ == "__main__":
    print("Starting JobBERT training loop...")
    trainer.train()
    
    # Save both the model and the tokenizer so they can be loaded together
    trainer.save_model(OUTPUT_DIR)
    tokenizer.save_pretrained(OUTPUT_DIR)
    
    print(f"Success! Model and tokenizer saved to {OUTPUT_DIR}. Ready for inference!")