import ast
import os


def extract_class_names_from_file(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        try:
            tree = ast.parse(f.read(), filename=file_path)
        except SyntaxError:
            return []  # skip files with syntax errors

    return [node.name for node in ast.walk(tree) if isinstance(node, ast.ClassDef)]


def extract_class_names_from_module(module_path):
    class_names = []
    for root, _, files in os.walk(module_path):
        for file in files:
            if file.endswith(".py"):
                file_path = os.path.join(root, file)
                class_names.extend(extract_class_names_from_file(file_path))
    return class_names


if __name__ == "__main__":
    import sys

    # if len(sys.argv) != 2:
    #     print("Usage: python extract_classes.py <module_path>")
    #     sys.exit(1)
    # module_path = sys.argv[1]
    module_path = "/Users/maximilientirard/Developer/Energetica/energetica/schemas"
    class_names = extract_class_names_from_module(module_path)
    for name in class_names:
        print(name)
