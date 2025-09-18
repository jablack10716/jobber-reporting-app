from setuptools import setup, find_packages

setup(
    name="jobber_reporting",
    version="0.1",
    packages=find_packages(),
    install_requires=[
        "requests>=2.25.0",
        "pandas",
        "matplotlib"
    ],
)
