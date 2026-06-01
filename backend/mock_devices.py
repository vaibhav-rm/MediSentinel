import asyncio
import httpx

MOCK_DEVICES = [
    {"device_id": "rad-mri-01", "device_type": "MRI_Scanner"},
    {"device_id": "rad-xray-02", "device_type": "XRay_Machine"},
    {"device_id": "er-infusion-04", "device_type": "Infusion_Pump"},
    {"device_id": "pharm-dispenser-01", "device_type": "Automated_Dispenser"},
    {"device_id": "icu-vent-02", "device_type": "Ventilator"}
]

async def seed_devices():
    async with httpx.AsyncClient() as client:
        for dev in MOCK_DEVICES:
            try:
                # Add to backend directly bypassing auth by using the DB directly
                pass
            except Exception as e:
                print(e)

if __name__ == "__main__":
    pass
