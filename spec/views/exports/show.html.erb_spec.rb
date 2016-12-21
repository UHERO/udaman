require 'rails_helper'

RSpec.describe "exports/show", type: :view do
  before(:each) do
    @export = assign(:export, Export.create!(
      :name => "Name",
      :created_by => 2,
      :updated_by => 3,
      :owned_by => 4
    ))
  end

  it "renders attributes in <p>" do
    render
    expect(rendered).to match(/Name/)
    expect(rendered).to match(/2/)
    expect(rendered).to match(/3/)
    expect(rendered).to match(/4/)
  end
end
