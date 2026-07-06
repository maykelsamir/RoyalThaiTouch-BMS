from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session


def install_branch_routes(app, Branch, BranchInput, get_db, create_audit):
    @app.patch('/branches/{branch_id}')
    def update_branch(branch_id: int, body: BranchInput, db: Session = Depends(get_db)):
        branch = db.query(Branch).filter(Branch.id == branch_id).first()
        if not branch:
            raise HTTPException(status_code=404, detail='Branch not found')
        duplicate = db.query(Branch).filter(Branch.name == body.name, Branch.id != branch_id).first()
        if duplicate:
            raise HTTPException(status_code=400, detail='Another branch already has this name')
        old_name = branch.name
        branch.name = body.name
        branch.address = body.address
        branch.active = body.active
        create_audit(db, 'UPDATE', 'Branch', f'{old_name} -> {body.name}')
        db.commit()
        db.refresh(branch)
        return branch

    @app.delete('/branches/{branch_id}')
    def delete_branch(branch_id: int, db: Session = Depends(get_db)):
        branch = db.query(Branch).filter(Branch.id == branch_id).first()
        if not branch:
            raise HTTPException(status_code=404, detail='Branch not found')
        branch.active = False
        create_audit(db, 'DELETE', 'Branch', branch.name)
        db.commit()
        return {'status': 'deleted'}
