from setuptools import find_packages, setup

setup(
    name="ingredient-extractor",
    version="0.1.0",
    description="Extract, normalize, and combine ingredient lists from multi-sheet recipe/menu-planning spreadsheets.",
    packages=find_packages(exclude=["tests"]),
    install_requires=[
        "pandas>=1.5",
        "openpyxl>=3.1",
    ],
    entry_points={
        "console_scripts": [
            "ingredient-extractor=ingredient_extractor.cli:main",
        ],
    },
    python_requires=">=3.10",
)
