from setuptools import setup, find_packages

setup(
    name="gomocup_engine",
    version="1.0.0",
    description="Python wrapper for Gomocup-protocol Gomoku/Renju AI engines (Yixin, Embryo, etc.)",
    long_description=open("README.md", encoding="utf-8").read(),
    long_description_content_type="text/markdown",
    author="Your Name",
    license="MIT",
    packages=find_packages(),
    python_requires=">=3.7",
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",
        "Operating System :: Microsoft :: Windows",
        "Topic :: Games/Entertainment :: Board Games",
    ],
)
