from datasets import load_dataset

print("Downloading sonchuate/resume_ner from Hugging Face...")
# Load the dataset
ds = load_dataset("sonchuate/resume_ner")

# Hugging Face datasets are usually split into 'train', 'test', etc.
# We will export the 'train' split directly to a JSON file.
print("Exporting to dataset.json...")
ds["train"].to_json("dataset.json")

print("Success! dataset.json has been created in your directory.")