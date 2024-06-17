<div style="text-align: center;">
    <img src="static/images/title.png" style="width: 100%;">
</div>

[BOSC](https://arxiv.org/abs/2406.05833) is an innovative tool that leverages AI for advanced agricultural management, promoting sustainability and environmental harmony.
Through aerial observation, we are paving the way for a brighter, greener future.

Accurate and efficient label of aerial images is essential for informed decision-making and resource allocation, whether in identifying crop types or delineating land-use patterns. 
The development of a comprehensive toolbox for manipulating and annotating aerial imagery represents a significant leap forward in remote sensing and spatial analysis.

## Applications

BOSC functionalities encompass conventional forest management, including tree classification, agricultural monitoring, and applications in semi-urban and urban environment

<div style="text-align: center;">
    <img src="static/images/examples.png" style="width: 100%;">
</div>

## Installation

### Prerequisites

Ensure you have the following software installed on your machine:
- Python >= 3.7
- (Optional) [Miniconda](https://docs.conda.io/en/latest/miniconda.html) for managing Python environments

### Step-by-Step Installation

1. **Clone the Repository**

First, clone the repository to your local machine using the following command:

```bash
git clone https://github.com/RicardDurall/BOSC_toolbox.git
```

2. **Create and Activate a Conda Environment** (Optional but recommended)

Navigate to the cloned BOSC directory and create a new Conda environment:

```bash
conda create -n bosc_env python=3.9
```

Activate the newly created environment:

```bash
conda activate bosc_env
```

3. **Install All Dependencies**

While inside the BOSC directory and with your Conda environment activated, install the required Python packages using the provided requirements.txt file:

```bash
cd BOSC_toolbox
pip install -r requirements.txt
```

4. **Download Pretrained Model**

Download the pretrained [FastSAM model](https://drive.google.com/file/d/1m1sjY4ihXBU1fZXdQ-Xdj-mDltW-2Rqv/view) and save the file under the BOSC directory within the cloned repository.

5. **Launch BOSC**

Run the following command to start the toolbox

```bash
python app.py
```

## Video-Turorial

A detailed tutorial can be found in the following video:

[![Watch the video](https://img.youtube.com/vi/WITneg41en0/0.jpg)](https://www.youtube.com/watch?v=WITneg41en0)

## Acknowledgement

[Segment Anything](https://segment-anything.com/) and [FastSAM](https://github.com/CASIA-IVA-Lab/FastSAM) provide codes and pre-trained models.

## Contact Information

For further questions or collaboration, please do not hesitate to contact us at:
ricard.durall.lopez@gmail.com

## Citing BOSC

If you find this project useful for your research, please consider citing us.

```bash
@misc{durall2024bosc,
      title={BOSC: A toolbox for aerial imagery mapping}, 
      author={Ricard Durall and Laura Montilla and Esteban Durall},
      year={2024},
      eprint={2406.05833},
      archivePrefix={arXiv},
      primaryClass={cs.CV}
}
```
